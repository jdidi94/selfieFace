'use client';

import { Locale } from '@lumea/types';
import { isRtlLocale } from '@lumea/utils';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const COOKIE = 'lumea_locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: 'ltr' | 'rtl';
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  const value = match?.[1];
  if (value === Locale.EN) return Locale.EN;
  if (value === Locale.AR) return Locale.AR;
  if (value === Locale.FR) return Locale.FR;
  return null;
}

function writeCookie(locale: Locale) {
  document.cookie = `${COOKIE}=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
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
