import {
  Currency,
  CURRENCY_BY_MARKET,
  Locale,
  MARKET_BY_CURRENCY,
  MarketCode,
  SUPPORTED_MARKET_CODES,
} from '@lumea/types';
import { isLocale, stripLocalePrefix } from '@/lib/locale-path';

/** Public URL segments for commercial windows (`/ae/...`, `/tn/...`, `/other/...`). */
export const MARKET_PATH_BY_CODE: Record<MarketCode, string> = {
  [MarketCode.AE]: 'ae',
  [MarketCode.TN]: 'tn',
  [MarketCode.OTHER]: 'other',
};

export const MARKET_CODE_BY_PATH: Record<string, MarketCode> = {
  ae: MarketCode.AE,
  tn: MarketCode.TN,
  other: MarketCode.OTHER,
};

const MARKET_PATH_SET = new Set(Object.keys(MARKET_CODE_BY_PATH));

export function isMarketPathSegment(value: string | undefined | null): boolean {
  return !!value && MARKET_PATH_SET.has(value.toLowerCase());
}

export function marketCodeFromPathSegment(
  value: string | undefined | null,
): MarketCode | null {
  if (!value) return null;
  return MARKET_CODE_BY_PATH[value.toLowerCase()] ?? null;
}

export function marketPathSegment(market: MarketCode | string): string {
  if (market in MARKET_PATH_BY_CODE) {
    return MARKET_PATH_BY_CODE[market as MarketCode];
  }
  return MARKET_PATH_BY_CODE[MarketCode.OTHER];
}

export function isMarketCode(value: string | undefined | null): value is MarketCode {
  return !!value && (SUPPORTED_MARKET_CODES as readonly string[]).includes(value);
}

export function marketFromCurrency(currency: Currency | string | undefined | null): MarketCode {
  if (currency === Currency.AED) return MarketCode.AE;
  if (currency === Currency.TND) return MarketCode.TN;
  if (currency === Currency.USD) return MarketCode.OTHER;
  if (isMarketCode(currency)) return currency;
  return MarketCode.OTHER;
}

export function currencyFromMarket(market: MarketCode): Currency {
  return CURRENCY_BY_MARKET[market];
}

export function currencyFromCookie(value: string | undefined | null): Currency {
  if (value === Currency.AED) return Currency.AED;
  if (value === Currency.TND) return Currency.TND;
  return Currency.USD;
}

/**
 * Strip leading `/{market}/{locale}` or legacy `/{locale}` from a pathname.
 * Returns the App Router bare path (e.g. `/shop`).
 */
export function stripMarketLocalePrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

  let i = 0;
  if (isMarketPathSegment(parts[i])) i += 1;
  if (parts[i] && isLocale(parts[i])) i += 1;

  if (i === 0) {
    return stripLocalePrefix(pathname);
  }

  const rest = '/' + parts.slice(i).join('/');
  return rest === '/' ? '/' : rest.replace(/\/$/, '') || '/';
}

/**
 * Build a storefront path: `/ae/en/shop`, `/other/fr`, etc.
 * Accepts bare or already-prefixed paths.
 */
export function withMarketLocale(
  market: MarketCode | string,
  locale: Locale | string,
  path = '/',
): string {
  const code = isMarketCode(market) ? market : marketFromCurrency(market);
  const seg = marketPathSegment(code);
  const loc = isLocale(locale) ? locale : Locale.EN;
  const bare = stripMarketLocalePrefix(path.startsWith('/') ? path : `/${path}`);
  if (bare === '/') return `/${seg}/${loc}`;
  return `/${seg}/${loc}${bare}`;
}

export function parseMarketLocalePath(pathname: string): {
  market: MarketCode | null;
  locale: Locale | null;
  bare: string;
} {
  const parts = pathname.split('/').filter(Boolean);
  let market: MarketCode | null = null;
  let locale: Locale | null = null;
  let i = 0;

  if (parts[i] && isMarketPathSegment(parts[i])) {
    market = marketCodeFromPathSegment(parts[i]);
    i += 1;
  }
  if (parts[i] && isLocale(parts[i])) {
    locale = parts[i] as Locale;
    i += 1;
  }

  const bare =
    i === 0
      ? stripLocalePrefix(pathname)
      : (() => {
          const rest = '/' + parts.slice(i).join('/');
          return rest === '/' ? '/' : rest.replace(/\/$/, '') || '/';
        })();

  return { market, locale, bare };
}

/** Map visitor country codes (CF / Vercel geo) → market window. */
export function marketFromCountryCode(country: string | undefined | null): MarketCode | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (c === 'AE') return MarketCode.AE;
  if (c === 'TN') return MarketCode.TN;
  return null;
}

export { MARKET_BY_CURRENCY, CURRENCY_BY_MARKET };
