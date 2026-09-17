'use client';

import { formatMoney } from '@lumea/utils';
import type { Currency } from '@lumea/types';

type Props = {
  currency: Currency | string;
  freeShippingThreshold: number;
  amountUntilFreeShipping: number;
  unlockedLabel: string;
  remainingLabel: (amount: string) => string;
};

/** Progress toward free-shipping threshold based on cart totals. */
export function FreeShippingProgress({
  currency,
  freeShippingThreshold,
  amountUntilFreeShipping,
  unlockedLabel,
  remainingLabel,
}: Props) {
  if (!freeShippingThreshold || freeShippingThreshold <= 0) return null;

  const unlocked = amountUntilFreeShipping <= 0;
  const progress = unlocked
    ? 100
    : Math.min(
        100,
        Math.round(
          ((freeShippingThreshold - amountUntilFreeShipping) / freeShippingThreshold) * 100,
        ),
      );

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-muted/40 px-3 py-3">
      <p className="text-xs text-muted-foreground">
        {unlocked
          ? unlockedLabel
          : remainingLabel(formatMoney(amountUntilFreeShipping, currency))}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
