'use client';

import { PriceRangeSlider } from '@/components/price-range-slider';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { ShopFilterValues } from '@/lib/shop-filters';
import { useState } from 'react';

type Props = {
  values: ShopFilterValues;
  boundsMin: number;
  boundsMax: number;
  currency: string;
};

export function ShopPriceFilter({ values, boundsMin, boundsMax, currency }: Props) {
  const { locale } = useLocale();
  const t = getMessages(locale);
  const initialMin = values.minPrice ? Number(values.minPrice) : boundsMin;
  const initialMax = values.maxPrice ? Number(values.maxPrice) : boundsMax;
  const [min, setMin] = useState(
    Number.isFinite(initialMin) ? initialMin : boundsMin,
  );
  const [max, setMax] = useState(
    Number.isFinite(initialMax) ? initialMax : boundsMax,
  );

  return (
    <div className="space-y-2">
      <span className="text-sm text-muted-foreground">{t.priceRange}</span>
      <PriceRangeSlider
        currency={currency}
        boundsMin={boundsMin}
        boundsMax={boundsMax}
        valueMin={min}
        valueMax={max}
        onChange={(lo, hi) => {
          setMin(lo);
          setMax(hi);
        }}
      />
      <input type="hidden" name="minPrice" value={String(min)} />
      <input type="hidden" name="maxPrice" value={String(max)} />
    </div>
  );
}
