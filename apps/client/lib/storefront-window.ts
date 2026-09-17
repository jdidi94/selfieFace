import {
  Currency,
  Locale,
  MarketCode,
  MARKET_BY_CURRENCY,
} from '@lumea/types';
import { cookies } from 'next/headers';
import { currencyFromCookie, marketFromCurrency } from '@/lib/market-path';

export function parseLocaleCookie(value?: string): Locale {
  if (value === Locale.AR) return Locale.AR;
  if (value === Locale.FR) return Locale.FR;
  return Locale.EN;
}

export function parseCurrencyCookie(value?: string): Currency {
  return currencyFromCookie(value);
}

/** Resolve market + locale + currency from storefront cookies (set by middleware). */
export async function getStorefrontWindow(): Promise<{
  locale: Locale;
  currency: Currency;
  market: MarketCode;
}> {
  const cookieStore = await cookies();
  const locale = parseLocaleCookie(cookieStore.get('lumea_locale')?.value);
  const currency = parseCurrencyCookie(cookieStore.get('lumea_currency')?.value);
  const market = marketFromCurrency(currency);
  return { locale, currency, market };
}

export { MARKET_BY_CURRENCY };
