import type { MetadataRoute } from 'next';
import {
  CURRENCY_BY_MARKET,
  MarketCode,
  SUPPORTED_LOCALES,
  type MarketDto,
} from '@lumea/types';
import { languageAlternates, siteUrl } from '@/lib/seo';
import { withMarketLocale } from '@/lib/market-path';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
/** Match products/journal public list max pageSize (validation max 48). */
const PAGE_SIZE = 48;
/** Cap pages to avoid runaway sitemap builds if the API misbehaves. */
const MAX_PAGES = 50;

type SlugRow = { slug: string; updatedAt?: string };

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function extractSlugs(data: unknown): SlugRow[] {
  if (!data) return [];
  const rows: { slug?: string; updatedAt?: string }[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data && 'items' in data
      ? ((data as { items: { slug?: string; updatedAt?: string }[] }).items ?? [])
      : [];
  const out: SlugRow[] = [];
  for (const row of rows) {
    if (!row.slug) continue;
    out.push({ slug: row.slug, updatedAt: row.updatedAt });
  }
  return out;
}

/** Paginate list endpoints until all slugs are collected (or caps hit). */
async function fetchAllSlugs(basePath: string): Promise<SlugRow[]> {
  const collected: SlugRow[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await fetchJson<unknown>(
      `${basePath}${sep}page=${page}&pageSize=${PAGE_SIZE}`,
    );
    if (!data) break;

    const rows = extractSlugs(data);
    for (const row of rows) {
      if (seen.has(row.slug)) continue;
      seen.add(row.slug);
      collected.push(row);
    }

    const total =
      typeof data === 'object' && data && 'total' in data
        ? Number((data as { total?: number }).total)
        : undefined;
    const pageSize =
      typeof data === 'object' && data && 'pageSize' in data
        ? Number((data as { pageSize?: number }).pageSize) || PAGE_SIZE
        : PAGE_SIZE;

    if (rows.length === 0) break;
    if (rows.length < pageSize) break;
    if (typeof total === 'number' && Number.isFinite(total) && collected.length >= total) {
      break;
    }
  }

  return collected;
}

async function enabledMarkets(): Promise<MarketCode[]> {
  const list = await fetchJson<MarketDto[]>('/markets');
  if (!list?.length) {
    return [MarketCode.AE, MarketCode.TN, MarketCode.OTHER];
  }
  return list.filter((m) => m.enabled).map((m) => m.code);
}

/** One sitemap row per locale within a market, with same-market hreflang alternates. */
function marketLocaleEntries(
  barePath: string,
  market: MarketCode,
  opts: {
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
    lastModified?: string | Date;
  },
): MetadataRoute.Sitemap {
  const languages = languageAlternates(barePath, market);
  const base = siteUrl().replace(/\/$/, '');
  return SUPPORTED_LOCALES.map((locale) => ({
    url: `${base}${withMarketLocale(market, locale, barePath)}`,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    lastModified: opts.lastModified,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const markets = await enabledMarkets();
  const staticPaths = [
    '/',
    '/shop',
    '/journal',
    '/help',
    '/about',
    '/contact',
    '/orders/track',
    '/track-order',
    '/legal/privacy',
    '/legal/terms',
    '/legal/cookies',
    '/legal/shipping',
    '/legal/returns',
  ] as const;

  const entries: MetadataRoute.Sitemap = [];

  for (const market of markets) {
    const currency = CURRENCY_BY_MARKET[market];
    const [products, categories, journal] = await Promise.all([
      fetchAllSlugs(`/products?locale=en&currency=${currency}`),
      fetchJson<unknown>(`/categories?locale=en&currency=${currency}`).then(extractSlugs),
      fetchAllSlugs(`/journal?locale=en&currency=${currency}`),
    ]);

    for (const path of staticPaths) {
      const isHome = path === '/';
      const isHighTraffic = path === '/' || path === '/shop';
      entries.push(
        ...marketLocaleEntries(path, market, {
          changeFrequency: isHighTraffic ? 'daily' : 'weekly',
          priority: isHome ? 1 : path.startsWith('/legal/') ? 0.4 : 0.7,
        }),
      );
    }

    for (const p of products) {
      entries.push(
        ...marketLocaleEntries(`/products/${p.slug}`, market, {
          changeFrequency: 'weekly',
          priority: 0.8,
          lastModified: p.updatedAt,
        }),
      );
    }
    for (const c of categories) {
      entries.push(
        ...marketLocaleEntries(`/shop/category/${c.slug}`, market, {
          changeFrequency: 'weekly',
          priority: 0.6,
          lastModified: c.updatedAt,
        }),
      );
    }
    for (const j of journal) {
      entries.push(
        ...marketLocaleEntries(`/journal/${j.slug}`, market, {
          changeFrequency: 'monthly',
          priority: 0.5,
          lastModified: j.updatedAt,
        }),
      );
    }
  }

  return entries;
}
