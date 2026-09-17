'use client';

import { Minus, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Button } from './button';
import { cn } from './lib/cn';

export type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
};

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  className,
  disabled,
  decreaseLabel = 'Decrease quantity',
  increaseLabel = 'Increase quantity',
}: QuantityStepperProps) {
  const decProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: 'button',
    disabled: disabled || value <= min,
    'aria-label': decreaseLabel,
    onClick: () => onChange(Math.max(min, value - 1)),
  };
  const incProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: 'button',
    disabled: disabled || value >= max,
    'aria-label': increaseLabel,
    onClick: () => onChange(Math.min(max, value + 1)),
  };

  return (
    <div
      className={cn(
        'inline-flex h-10 items-stretch overflow-hidden rounded-sm border border-border bg-surface',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-full w-9 shrink-0 rounded-none border-e border-border"
        {...decProps}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="flex min-w-9 items-center justify-center px-2 text-sm tabular-nums">
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-full w-9 shrink-0 rounded-none border-s border-border"
        {...incProps}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
