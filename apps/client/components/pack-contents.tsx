'use client';

import { mediaUrl } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { withMarketLocale } from '@/lib/market-path';
import { getMessages } from '@/lib/messages';
import type { PackComponentDto } from '@lumea/types';
import { MARKET_BY_CURRENCY } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import { ProductImage } from '@lumea/ui';
import Link from 'next/link';

type PackContentsProps = {
  components: PackComponentDto[];
  packPrice: number;
  compareAtFrom?: number | null;
  savings?: number | null;
  currency: string;
};

export function PackContents({
  components,
  packPrice,
  compareAtFrom,
  savings,
  currency,
}: PackContentsProps) {
  const { locale } = useLocale();
  const { currency: windowCurrency } = useCurrency();
  const market = MARKET_BY_CURRENCY[windowCurrency];
  const t = getMessages(locale);
  if (!components.length) return null;

  const compare = compareAtFrom ?? components.reduce((sum, c) => sum + c.linePrice, 0);
  const saved = savings ?? Math.max(0, compare - packPrice);

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface-muted/30 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">{t.packContentsTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.packContentsHint}</p>
        </div>
        {saved > 0 ? (
          <p className="text-sm font-medium text-foreground">
            {t.packSaveAmount(formatMoney(saved, currency))}
          </p>
        ) : null}
      </div>

      <ul className="mt-5 space-y-3">
        {components.map((c) => (
          <li key={c.id} className="flex gap-3">
            <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
              <ProductImage
                src={mediaUrl(c.imageUrl)}
                alt={c.productName}
                className="absolute inset-0 aspect-auto h-full w-full max-h-none"
                sizes="56px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={withMarketLocale(market, locale, `/products/${c.productSlug}`)}
                className="font-medium text-foreground hover:underline"
              >
                {c.productName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {c.variantName}
                {c.quantity > 1 ? ` × ${c.quantity}` : ''}
              </p>
            </div>
            <p className="shrink-0 text-sm text-muted-foreground">
              {formatMoney(c.linePrice, currency)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{t.packBuySeparately}</span>
          <span className={saved > 0 ? 'line-through' : undefined}>
            {formatMoney(compare, currency)}
          </span>
        </div>
        <div className="flex justify-between font-medium text-foreground">
          <span>{t.packPrice}</span>
          <span>{formatMoney(packPrice, currency)}</span>
        </div>
      </div>
    </section>
  );
}
