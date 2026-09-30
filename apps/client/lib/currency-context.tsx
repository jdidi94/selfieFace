'use client';

import { Currency } from '@lumea/types';
import { currencyFromRegion } from '@lumea/utils';
import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_LEGACY,
  PREFERENCE_COOKIE_MAX_AGE,
  readCookieMigrating,
  writeCookieMigrating,
} from '@/lib/storefront-cookies';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type CurrencyContextValue = {
  currency: Currency;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function parseCurrency(value: string | null | undefined): Currency | null {
  if (value === Currency.USD) return Currency.USD;
  if (value === Currency.TND) return Currency.TND;
  if (value === Currency.AED) return Currency.AED;
  return null;
}

/**
 * Currency is cookie / geo driven only — no storefront switcher.
 */
export function CurrencyProvider({
  children,
  initialCurrency = Currency.USD,
}: {
  children: ReactNode;
  initialCurrency?: Currency;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  useEffect(() => {
    const fromCookie = parseCurrency(
      readCookieMigrating(CURRENCY_COOKIE, CURRENCY_COOKIE_LEGACY, PREFERENCE_COOKIE_MAX_AGE),
    );
    if (fromCookie) {
      if (fromCookie !== initialCurrency) setCurrencyState(fromCookie);
      return;
    }

    const region =
      typeof navigator !== 'undefined'
        ? `${navigator.language},${Intl.DateTimeFormat().resolvedOptions().timeZone}`
        : '';
    const detected = currencyFromRegion(region) as Currency;
    setCurrencyState(detected);
    writeCookieMigrating(
      CURRENCY_COOKIE,
      CURRENCY_COOKIE_LEGACY,
      detected,
      PREFERENCE_COOKIE_MAX_AGE,
    );
  }, [initialCurrency]);

  const value = useMemo(() => ({ currency }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}
