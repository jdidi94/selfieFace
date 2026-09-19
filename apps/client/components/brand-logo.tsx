'use client';

import { cn } from '@lumea/ui';
import Image from 'next/image';
import type { ComponentPropsWithoutRef } from 'react';

/** Transparent lockup (no plate) — `wordmark_inverted.png`. */
const BRAND = {
  mark: '/brand/mark.png',
  wordmark: '/brand/wordmark_inverted.png',
  name: 'Selfieface',
} as const;

type BrandLogoProps = {
  /** `header` / `lockup`: transparent wordmark; `mark`: emblem only */
  variant?: 'header' | 'lockup' | 'mark';
  className?: string;
  priority?: boolean;
} & Omit<ComponentPropsWithoutRef<'span'>, 'children'>;

export function BrandLogo({
  variant = 'header',
  className,
  priority,
  ...rest
}: BrandLogoProps) {
  if (variant === 'mark') {
    return (
      <span className={cn('inline-flex items-center', className)} {...rest}>
        <Image
          src={BRAND.mark}
          alt={BRAND.name}
          width={40}
          height={40}
          priority={priority}
          className="h-9 w-9 object-contain"
        />
      </span>
    );
  }

  const heightClass =
    variant === 'lockup' ? 'h-14 w-auto object-contain sm:h-16' : 'h-9 w-auto object-contain sm:h-10';

  return (
    <span className={cn('inline-flex items-center', className)} {...rest}>
      <Image
        src={BRAND.wordmark}
        alt={BRAND.name}
        width={180}
        height={120}
        priority={priority}
        className={heightClass}
      />
    </span>
  );
}
