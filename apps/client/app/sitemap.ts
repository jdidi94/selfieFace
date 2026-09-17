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

async function fetchSlugs(path: string): Promise<SlugRow[]> {
  const data = await fetchJson<unknown>(path);
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map((row) => {
        const r = row as { slug?: string };
        return r.slug ? { slug: r.slug } : null;
      })
      .filter((x): x is SlugRow => !!x);
  }
  if (typeof data === 'object' && data && 'items' in data) {
    const items = (data as { items: { slug?: string }[] }).items ?? [];
    return items
      .map((row) => (row.slug ? { slug: row.slug } : null))
      .filter((x): x is SlugRow => !!x);
  }
  return [];
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
  const staticPaths = ['/', '/shop', '/journal', '/cart', '/wishlist'] as const;

  const entries: MetadataRoute.Sitemap = [];

  for (const market of markets) {
    const currency = CURRENCY_BY_MARKET[market];
    const [products, categories, journal] = await Promise.all([
      fetchSlugs(`/products?page=1&pageSize=48&locale=en&currency=${currency}`),
      fetchSlugs(`/categories?locale=en&currency=${currency}`),
      fetchSlugs(`/journal?page=1&pageSize=48&locale=en&currency=${currency}`),
    ]);

    for (const path of staticPaths) {
      entries.push(
        ...marketLocaleEntries(path, market, {
          changeFrequency: path === '/' || path === '/shop' ? 'daily' : 'weekly',
          priority: path === '/' ? 1 : 0.7,
        }),
      );
    }

    for (const p of products) {
      entries.push(
        ...marketLocaleEntries(`/products/${p.slug}`, market, {
          changeFrequency: 'weekly',
          priority: 0.8,
        }),
      );
    }
    for (const c of categories) {
      entries.push(
        ...marketLocaleEntries(`/shop/category/${c.slug}`, market, {
          changeFrequency: 'weekly',
          priority: 0.6,
        }),
      );
    }
    for (const j of journal) {
      entries.push(
        ...marketLocaleEntries(`/journal/${j.slug}`, market, {
          changeFrequency: 'monthly',
          priority: 0.5,
        }),
      );
    }
  }

  return entries;
}
