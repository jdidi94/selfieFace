import { withMarketLocale } from '@/lib/market-path';
import { getStorefrontWindow } from '@/lib/storefront-window';
import { redirect } from 'next/navigation';

/** Short sitelink alias → guest order tracking (market + locale aware). */
export default async function TrackOrderAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, market } = await getStorefrontWindow();
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(
    withMarketLocale(market, locale, `/orders/track${query ? `?${query}` : ''}`),
  );
}
