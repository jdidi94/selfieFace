'use client';

import { Currency } from '@lumea/types';
import { currencyFromRegion } from '@lumea/utils';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const COOKIE = 'lumea_currency';

type CurrencyContextValue = {
  currency: Currency;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

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
    const fromCookie = parseCurrency(readCookie(COOKIE));
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
    writeCookie(COOKIE, detected);
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
