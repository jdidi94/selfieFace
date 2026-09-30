import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Locale, MarketCode, SUPPORTED_LOCALES } from '@lumea/types';
import { isLocale } from '@/lib/locale-path';
import {
  currencyFromCookie,
  currencyFromMarket,
  marketFromCountryCode,
  marketFromCurrency,
  parseMarketLocalePath,
  withMarketLocale,
} from '@/lib/market-path';
import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_LEGACY,
  LOCALE_COOKIE,
  LOCALE_COOKIE_LEGACY,
  PREFERENCE_COOKIE_MAX_AGE,
} from '@/lib/storefront-cookies';

function defaultLocale(request: NextRequest): Locale {
  const fromCookie =
    request.cookies.get(LOCALE_COOKIE)?.value ??
    request.cookies.get(LOCALE_COOKIE_LEGACY)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return Locale.EN;
}

function defaultMarket(request: NextRequest): MarketCode {
  const currencyValue =
    request.cookies.get(CURRENCY_COOKIE)?.value ??
    request.cookies.get(CURRENCY_COOKIE_LEGACY)?.value;
  if (currencyValue) {
    return marketFromCurrency(currencyFromCookie(currencyValue));
  }
  const geoCountry =
    (request as NextRequest & { geo?: { country?: string } }).geo?.country ??
    request.headers.get('cf-ipcountry') ??
    request.headers.get('x-vercel-ip-country');
  return marketFromCountryCode(geoCountry) ?? MarketCode.OTHER;
}

function setMarketLocaleCookies(
  response: NextResponse,
  market: MarketCode,
  locale: Locale,
) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
  response.cookies.set(CURRENCY_COOKIE, currencyFromMarket(market), {
    path: '/',
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
  // Drop legacy names once migrated.
  response.cookies.set(LOCALE_COOKIE_LEGACY, '', { path: '/', maxAge: 0 });
  response.cookies.set(CURRENCY_COOKIE_LEGACY, '', { path: '/', maxAge: 0 });
}

/**
 * Market + locale path prefixes: `/ae/en/shop`, `/tn/ar/products/x`, `/other/fr`.
 * Rewrites to the unprefixed App Router path and syncs `selfieface_currency` + `selfieface_locale`.
 * Bare or locale-only paths redirect into `/{market}/{locale}/...`.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static brand chrome and other public files must not get market/locale prefixes.
  if (
    pathname.startsWith('/brand/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/feeds/') ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|webmanifest|json|map|js)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Preserve legacy `?hl=` landings by redirecting into market+locale paths.
  const hl = request.nextUrl.searchParams.get('hl');
  if (hl && isLocale(hl)) {
    const market = defaultMarket(request);
    const url = request.nextUrl.clone();
    url.searchParams.delete('hl');
    const { bare } = parseMarketLocalePath(pathname);
    url.pathname = withMarketLocale(market, hl, bare);
    const response = NextResponse.redirect(url);
    setMarketLocaleCookies(response, market, hl);
    return response;
  }

  const parsed = parseMarketLocalePath(pathname);
  const market = parsed.market ?? defaultMarket(request);
  const locale = parsed.locale ?? defaultLocale(request);

  // Full `/{market}/{locale}/...` → rewrite to bare app path.
  if (parsed.market && parsed.locale) {
    const url = request.nextUrl.clone();
    url.pathname = parsed.bare;
    const response = NextResponse.rewrite(url);
    setMarketLocaleCookies(response, parsed.market, parsed.locale);
    return response;
  }

  // Missing market and/or locale → redirect into the canonical prefixed URL.
  const url = request.nextUrl.clone();
  url.pathname = withMarketLocale(market, locale, parsed.bare);
  const response = NextResponse.redirect(url);
  setMarketLocaleCookies(response, market, locale);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sw\\.js|offline\\.html|feeds|uploads|brand/).*)',
  ],
};

export const SUPPORTED_PATH_LOCALES = SUPPORTED_LOCALES;
