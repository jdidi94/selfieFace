import {
  CURRENCY_BY_MARKET,
  Locale,
  MarketCode,
  type ProductListItem,
  type ProductListResponse,
} from '@lumea/types';
import { resolveMediaUrl } from '@lumea/utils';
import { withMarketLocale } from '@/lib/market-path';
import { siteUrl } from '@/lib/seo';
import { NextResponse } from 'next/server';

export const revalidate = 3600;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const mediaBaseUrl =
  process.env.NEXT_PUBLIC_MEDIA_URL?.trim() ||
  process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.trim() ||
  null;
const PAGE_SIZE = 48;
const MAX_PAGES = 50;

const MARKET_CODES = new Set<string>(Object.values(MarketCode));

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteMedia(pathOrUrl: string | null | undefined): string | null {
  const resolved = resolveMediaUrl(pathOrUrl, { apiUrl, mediaBaseUrl });
  if (!resolved) return null;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  const base = siteUrl().replace(/\/$/, '');
  return `${base}${resolved.startsWith('/') ? resolved : `/${resolved}`}`;
}

async function fetchAllProducts(market: MarketCode): Promise<ProductListItem[]> {
  const currency = CURRENCY_BY_MARKET[market];
  const items: ProductListItem[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    try {
      const res = await fetch(
        `${apiUrl}/products?page=${page}&pageSize=${PAGE_SIZE}&locale=en&currency=${currency}`,
        { next: { revalidate: 3600 } },
      );
      if (!res.ok) break;
      const data = (await res.json()) as ProductListResponse;
      if (!data.items?.length) break;
      for (const item of data.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
      if (data.items.length < (data.pageSize || PAGE_SIZE)) break;
      if (typeof data.total === 'number' && items.length >= data.total) break;
    } catch {
      break;
    }
  }

  return items;
}

function priceLabel(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function itemXml(product: ProductListItem, market: MarketCode): string | null {
  const image = absoluteMedia(product.imageUrl);
  if (!image) return null;

  const link = `${siteUrl().replace(/\/$/, '')}${withMarketLocale(
    market,
    Locale.EN,
    `/products/${product.slug}`,
  )}`;
  const description =
    product.shortDescription?.trim() ||
    product.name;
  const availability = product.inStock ? 'in_stock' : 'out_of_stock';
  const id = `${market}-${product.id}`;

  const lines = [
    '<item>',
    `<g:id>${xmlEscape(id)}</g:id>`,
    `<g:title>${xmlEscape(product.name)}</g:title>`,
    `<g:description>${xmlEscape(description)}</g:description>`,
    `<g:link>${xmlEscape(link)}</g:link>`,
    `<g:image_link>${xmlEscape(image)}</g:image_link>`,
    `<g:availability>${availability}</g:availability>`,
    `<g:condition>new</g:condition>`,
    `<g:price>${xmlEscape(priceLabel(product.priceFrom, product.currency))}</g:price>`,
    product.brand?.name
      ? `<g:brand>${xmlEscape(product.brand.name)}</g:brand>`
      : '',
    product.category?.name
      ? `<g:product_type>${xmlEscape(product.category.name)}</g:product_type>`
      : '',
    '</item>',
  ];

  return lines.filter(Boolean).join('\n');
}

type RouteParams = { params: Promise<{ market: string }> };

/**
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 * Schedule in Merchant Center: `https://your-domain/feeds/google-merchant/ae`
 * (also `tn`, `other`).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { market: raw } = await params;
  const code = raw?.toUpperCase();
  if (!code || !MARKET_CODES.has(code)) {
    return new NextResponse('Unknown market. Use ae, tn, or other.', { status: 404 });
  }
  const market = code as MarketCode;
  const products = await fetchAllProducts(market);
  const items = products
    .map((p) => itemXml(p, market))
    .filter((x): x is string => Boolean(x));

  const base = siteUrl().replace(/\/$/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Selfieface ${market}</title>
    <link>${xmlEscape(base)}</link>
    <description>Selfieface product feed (${market})</description>
${items.map((block) => `    ${block.replace(/\n/g, '\n    ')}`).join('\n')}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
