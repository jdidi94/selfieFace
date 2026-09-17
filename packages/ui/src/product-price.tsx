import type { Currency } from '@lumea/types';
import type { HTMLAttributes } from 'react';
import { cn } from './lib/cn';

function formatAmount(amount: number, currency: string) {
  const locales: Record<string, string> = {
    USD: 'en-US',
    TND: 'fr-TN',
    AED: 'ar-AE',
  };
  return new Intl.NumberFormat(locales[currency] ?? 'en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

export type ProductPriceProps = HTMLAttributes<HTMLSpanElement> & {
  price: number;
  compareAtPrice?: number | null;
  currency?: Currency | string;
};

export function ProductPrice({
  price,
  compareAtPrice,
  currency = 'USD',
  className,
  ...props
}: ProductPriceProps) {
  const code = String(currency);
  const onSale = typeof compareAtPrice === 'number' && compareAtPrice > price;

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)} {...props}>
      <span className="font-medium text-foreground">{formatAmount(price, code)}</span>
      {onSale && (
        <span className="text-sm text-muted-foreground line-through">
          {formatAmount(compareAtPrice, code)}
        </span>
      )}
    </span>
  );
}
