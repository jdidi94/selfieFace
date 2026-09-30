import {
  CURRENCY_BY_MARKET,
  MarketCode,
  type MarketDto,
  type ProductListResponse,
} from '@lumea/types';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const PAGE_SIZE = 48;
const MAX_PAGES = 50;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function enabledMarkets(): Promise<MarketCode[]> {
  const list = await fetchJson<MarketDto[]>('/markets');
  if (!list?.length) {
    return [MarketCode.AE, MarketCode.TN, MarketCode.OTHER];
  }
  return list.filter((m) => m.enabled).map((m) => m.code);
}

/** Unique product slugs across enabled markets (for `generateStaticParams`). */
export async function fetchAllProductSlugs(): Promise<string[]> {
  const markets = await enabledMarkets();
  const seen = new Set<string>();

  for (const market of markets) {
    const currency = CURRENCY_BY_MARKET[market];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await fetchJson<ProductListResponse>(
        `/products?page=${page}&pageSize=${PAGE_SIZE}&locale=en&currency=${currency}`,
      );
      if (!data?.items?.length) break;
      for (const item of data.items) {
        if (item.slug) seen.add(item.slug);
      }
      if (data.items.length < (data.pageSize || PAGE_SIZE)) break;
      if (typeof data.total === 'number' && seen.size >= data.total && markets.length === 1) {
        break;
      }
      if (data.items.length < PAGE_SIZE) break;
    }
  }

  return [...seen];
}

/** Unique category slugs across enabled markets. */
export async function fetchAllCategorySlugs(): Promise<string[]> {
  const markets = await enabledMarkets();
  const seen = new Set<string>();

  for (const market of markets) {
    const currency = CURRENCY_BY_MARKET[market];
    const data = await fetchJson<unknown>(`/categories?locale=en&currency=${currency}`);
    if (!data) continue;
    const rows = Array.isArray(data)
      ? data
      : typeof data === 'object' && data && 'items' in data
        ? ((data as { items: unknown[] }).items ?? [])
        : [];
    for (const row of rows) {
      const slug = (row as { slug?: string }).slug;
      if (slug) seen.add(slug);
    }
  }

  return [...seen];
}

/** Unique journal article slugs across enabled markets. */
export async function fetchAllJournalSlugs(): Promise<string[]> {
  const markets = await enabledMarkets();
  const seen = new Set<string>();

  for (const market of markets) {
    const currency = CURRENCY_BY_MARKET[market];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await fetchJson<{
        items?: { slug?: string }[];
        total?: number;
        pageSize?: number;
      }>(`/journal?page=${page}&pageSize=${PAGE_SIZE}&locale=en&currency=${currency}`);
      if (!data?.items?.length) break;
      for (const item of data.items) {
        if (item.slug) seen.add(item.slug);
      }
      if (data.items.length < (data.pageSize || PAGE_SIZE)) break;
    }
  }

  return [...seen];
}
