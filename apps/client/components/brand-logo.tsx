'use client';

import { useTheme } from '@/lib/theme-context';
import { cn } from '@lumea/ui';
import Image from 'next/image';
import type { ComponentPropsWithoutRef } from 'react';

const BRAND = {
  mark: '/brand/mark.png',
  lockupLight: '/brand/lockup-light.png',
  lockupDark: '/brand/lockup-dark.png',
  name: 'Selfieface',
} as const;

type BrandLogoProps = {
  /** `header`: mark + wordmark text; `lockup`: stacked emblem+type; `mark`: emblem only */
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
  const { theme } = useTheme();
  const dark = theme === 'dark';

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

  if (variant === 'lockup') {
    const src = dark ? BRAND.lockupDark : BRAND.lockupLight;
    return (
      <span className={cn('inline-flex items-center', className)} {...rest}>
        <Image
          src={src}
          alt={BRAND.name}
          width={180}
          height={154}
          priority={priority}
          className="h-14 w-auto object-contain sm:h-16"
        />
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-2.5', className)}
      {...rest}
    >
      <Image
        src={BRAND.mark}
        alt=""
        width={40}
        height={40}
        priority={priority}
        className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
        aria-hidden
      />
      <span className="font-display text-xl font-medium tracking-tight text-foreground sm:text-2xl">
        {BRAND.name}
      </span>
    </span>
  );
}
