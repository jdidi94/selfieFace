'use client';

import { useCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { apiUrl } from '@/lib/api';
import { getMessages } from '@/lib/messages';
import type { ActiveCouponDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import {
  COUPONS_BAR_DISMISS_KEY,
  COUPONS_BAR_DISMISS_KEY_LEGACY,
  readStorageMigrating,
  writeStorageMigrating,
} from '@/lib/storefront-cookies';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function ActiveCouponsBar() {
  const { currency } = useCurrency();
  const { locale } = useLocale();
  const { applyCoupon, cart } = useCart();
  const t = getMessages(locale);
  const [coupons, setCoupons] = useState<ActiveCouponDto[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(
        readStorageMigrating(
          sessionStorage,
          COUPONS_BAR_DISMISS_KEY,
          COUPONS_BAR_DISMISS_KEY_LEGACY,
        ) === '1',
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiUrl}/store/coupons?currency=${encodeURIComponent(currency)}`)
      .then(async (res) => {
        if (!res.ok) return [] as ActiveCouponDto[];
        return (await res.json()) as ActiveCouponDto[];
      })
      .then((data) => {
        if (!cancelled) setCoupons(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      writeStorageMigrating(
        sessionStorage,
        COUPONS_BAR_DISMISS_KEY,
        COUPONS_BAR_DISMISS_KEY_LEGACY,
        '1',
      );
    } catch {
      // ignore
    }
  }, []);

  const onCopy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      // ignore
    }
  }, []);

  const onApply = useCallback(
    async (code: string) => {
      setPendingCode(code);
      try {
        await applyCoupon(code);
      } catch {
        // cart UI surfaces errors elsewhere
      } finally {
        setPendingCode(null);
      }
    },
    [applyCoupon],
  );

  if (dismissed || !coupons.length) return null;

  const appliedCode = cart?.coupon?.code ?? null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden border-b border-border/60 bg-gradient-to-r from-rose-50/90 via-background to-amber-50/70 dark:from-rose-950/30 dark:via-background dark:to-amber-950/20"
      >
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 sm:items-center sm:px-6">
          <Tag className="mt-0.5 h-4 w-4 shrink-0 text-rose-700/80 dark:text-rose-300/80" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.activeCouponsTitle}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {coupons.map((c) => {
                const summary =
                  c.type === 'PERCENT'
                    ? `${c.percentOff ?? 0}%`
                    : c.amountOff != null
                      ? formatMoney(c.amountOff, currency)
                      : c.code;
                const isApplied = appliedCode === c.code;
                return (
                  <li
                    key={c.code}
                    className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-sm"
                  >
                    <span className="font-medium tracking-wide">{c.code}</span>
                    <span className="text-muted-foreground">{summary}</span>
                    {c.description ? (
                      <span className="text-foreground/70">{c.description}</span>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-800 underline-offset-2 hover:underline dark:text-rose-200"
                      onClick={() => void onCopy(c.code)}
                    >
                      {copied === c.code ? t.activeCouponsCopied : t.activeCouponsCopy}
                    </button>
                    {!isApplied ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                        disabled={pendingCode === c.code}
                        onClick={() => void onApply(c.code)}
                      >
                        {t.activeCouponsApply}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.couponApplied}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t.activeCouponsDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
