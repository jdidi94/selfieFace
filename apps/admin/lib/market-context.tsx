'use client';

import { MarketCode, type MarketDto } from '@lumea/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminFetch, invalidateAdminCache } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const COOKIE = 'admin_market';

type MarketContextValue = {
  market: MarketCode;
  markets: MarketDto[];
  setMarket: (code: MarketCode) => void;
  loading: boolean;
};

const MarketContext = createContext<MarketContextValue | null>(null);

function parseMarket(value?: string | null): MarketCode {
  if (value === MarketCode.AE) return MarketCode.AE;
  if (value === MarketCode.TN) return MarketCode.TN;
  return MarketCode.OTHER;
}

function readCookie(): MarketCode | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  return match?.[1] ? parseMarket(match[1]) : null;
}

function writeCookie(code: MarketCode) {
  document.cookie = `${COOKIE}=${code};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

const LABELS: Record<MarketCode, string> = {
  [MarketCode.AE]: 'Emirates (AED)',
  [MarketCode.TN]: 'Tunisia (TND)',
  [MarketCode.OTHER]: 'Others (USD)',
};

export function marketLabel(code: MarketCode) {
  return LABELS[code] ?? code;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const { accessToken, loading: authLoading } = useAuth();
  const [market, setMarketState] = useState<MarketCode>(MarketCode.OTHER);
  const [markets, setMarkets] = useState<MarketDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fromCookie = readCookie();
    if (fromCookie) setMarketState(fromCookie);
  }, []);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let cancelled = false;
    void adminFetch<MarketDto[]>('/admin/markets', accessToken)
      .then((rows) => {
        if (!cancelled) setMarkets(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setMarkets([
            {
              id: 'market_ae',
              code: MarketCode.AE,
              name: 'Emirates',
              currency: 'AED' as MarketDto['currency'],
              enabled: true,
            },
            {
              id: 'market_tn',
              code: MarketCode.TN,
              name: 'Tunisia',
              currency: 'TND' as MarketDto['currency'],
              enabled: true,
            },
            {
              id: 'market_other',
              code: MarketCode.OTHER,
              name: 'Rest of world',
              currency: 'USD' as MarketDto['currency'],
              enabled: true,
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading]);

  const setMarket = useCallback((code: MarketCode) => {
    // Cookie first so remounted pages send the correct x-market header.
    writeCookie(code);
    invalidateAdminCache();
    setMarketState(code);
  }, []);

  const value = useMemo(
    () => ({ market, markets, setMarket, loading }),
    [market, markets, setMarket, loading],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useAdminMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useAdminMarket must be used within MarketProvider');
  return ctx;
}
