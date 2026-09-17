'use client';

import { formatMoney } from '@lumea/utils';
import { useEffect, useState } from 'react';

type Props = {
  currency: string;
  boundsMin: number;
  boundsMax: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
};

export function PriceRangeSlider({
  currency,
  boundsMin,
  boundsMax,
  valueMin,
  valueMax,
  onChange,
}: Props) {
  const [lo, setLo] = useState(valueMin);
  const [hi, setHi] = useState(valueMax);

  useEffect(() => {
    setLo(valueMin);
    setHi(valueMax);
  }, [valueMin, valueMax]);

  const min = boundsMin;
  const max = Math.max(boundsMax, boundsMin + 1);
  const span = max - min;

  function pct(value: number) {
    return ((value - min) / span) * 100;
  }

  return (
    <div className="space-y-3">
      <div className="relative h-8">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
          style={{
            left: `${pct(lo)}%`,
            width: `${Math.max(pct(hi) - pct(lo), 0)}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={lo}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-surface"
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), hi);
            setLo(next);
            onChange(next, hi);
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={hi}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-surface"
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), lo);
            setHi(next);
            onChange(lo, next);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatMoney(lo, currency)} – {formatMoney(hi, currency)}
      </p>
    </div>
  );
}
