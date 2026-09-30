'use client';

import { Locale } from '@lumea/types';
import { isRtlLocale } from '@lumea/utils';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_LEGACY,
  PREFERENCE_COOKIE_MAX_AGE,
  readCookieMigrating,
  writeCookieMigrating,
} from '@/lib/storefront-cookies';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: 'ltr' | 'rtl';
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookie(): Locale | null {
  const value = readCookieMigrating(LOCALE_COOKIE, LOCALE_COOKIE_LEGACY, PREFERENCE_COOKIE_MAX_AGE);
  if (value === Locale.EN) return Locale.EN;
  if (value === Locale.AR) return Locale.AR;
  if (value === Locale.FR) return Locale.FR;
  return null;
}

function writeCookie(locale: Locale) {
  writeCookieMigrating(LOCALE_COOKIE, LOCALE_COOKIE_LEGACY, locale, PREFERENCE_COOKIE_MAX_AGE);
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
}

export function LocaleProvider({
  children,
  initialLocale = Locale.EN,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const fromCookie = readCookie();
    if (fromCookie) {
      if (fromCookie !== initialLocale) {
        setLocaleState(fromCookie);
      }
      applyDocumentLocale(fromCookie);
      return;
    }
    // Keep SSR locale; only persist it — do not auto-switch from navigator (hydration-safe).
    writeCookie(initialLocale);
    applyDocumentLocale(initialLocale);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie(next);
    applyDocumentLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dir: isRtlLocale(locale) ? ('rtl' as const) : ('ltr' as const),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
