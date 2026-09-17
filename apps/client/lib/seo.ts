import { Locale, MarketCode, SUPPORTED_LOCALES } from '@lumea/types';
import {
  marketPathSegment,
  stripMarketLocalePrefix,
  withMarketLocale,
} from '@/lib/market-path';

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export function absoluteUrl(path: string) {
  const base = siteUrl().replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

/**
 * Absolute storefront URL with market + locale prefixes
 * (`/ae/en/...`, `/tn/ar/...`, `/other/fr/...`).
 */
export function localizedAbsoluteUrl(
  locale: Locale,
  path: string,
  market: MarketCode = MarketCode.OTHER,
) {
  return absoluteUrl(withMarketLocale(market, locale, path));
}

/** Bare app path (no market/locale prefix). */
function barePath(path: string) {
  return stripMarketLocalePrefix(path);
}

/**
 * hreflang language tag for a market window.
 * AE/TN use regional tags (`en-AE`); OTHER uses bare locale (`en`).
 */
export function hreflangFor(market: MarketCode, locale: Locale): string {
  if (market === MarketCode.OTHER) return locale;
  return `${locale}-${market}`;
}

/**
 * Locale alternates for the **same market** only (catalogs differ per window).
 * `x-default` → same-market English (not cross-market).
 */
export function languageAlternates(
  path: string,
  market: MarketCode = MarketCode.OTHER,
): Record<string, string> {
  const bare = barePath(path);
  const languages: Record<string, string> = {
    'x-default': absoluteUrl(withMarketLocale(market, Locale.EN, bare)),
  };
  for (const locale of SUPPORTED_LOCALES) {
    languages[hreflangFor(market, locale)] = absoluteUrl(
      withMarketLocale(market, locale, bare),
    );
  }
  return languages;
}

export function seoAlternates(
  path: string,
  locale: Locale = Locale.EN,
  market: MarketCode = MarketCode.OTHER,
) {
  const bare = barePath(path);
  return {
    canonical: absoluteUrl(withMarketLocale(market, locale, bare)),
    languages: languageAlternates(bare, market),
  };
}

/** Open Graph / Twitter image entry from a resolved media URL. */
export function seoImages(imageUrl: string | null | undefined, alt?: string) {
  if (!imageUrl) return undefined;
  return [{ url: imageUrl, alt: alt || undefined }];
}

export function marketSegmentLabel(market: MarketCode): string {
  return marketPathSegment(market);
}
