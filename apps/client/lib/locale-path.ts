import { Locale, SUPPORTED_LOCALES } from '@lumea/types';

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && LOCALE_SET.has(value);
}

/** Strip a leading `/en|/ar|/fr` prefix if present. */
export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split('/');
  if (parts.length > 1 && isLocale(parts[1])) {
    const rest = '/' + parts.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/$/, '') || '/';
  }
  return pathname || '/';
}

/** Prefix a path with locale: `/shop` → `/en/shop`. */
export function withLocale(locale: Locale | string, path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const bare = stripLocalePrefix(normalized);
  const loc = isLocale(locale) ? locale : Locale.EN;
  if (bare === '/') return `/${loc}`;
  return `/${loc}${bare}`;
}

export function localeFromPathname(pathname: string): Locale | null {
  const seg = pathname.split('/')[1];
  return isLocale(seg) ? seg : null;
}
