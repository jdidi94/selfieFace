'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from './lib/cn';

export type DefaultImageKind = 'product' | 'pack' | 'journal' | 'banner' | 'brand';

const DEFAULT_IMAGES: Record<DefaultImageKind, string> = {
  product: '/images/defaults/product.webp',
  pack: '/images/defaults/pack.webp',
  journal: '/images/defaults/journal.webp',
  banner: '/images/defaults/banner.webp',
  brand: '/images/defaults/brand.webp',
};

export type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  /** Prefer for LCP hero images on PDP. */
  priority?: boolean;
  /**
   * `next/image` sizes attribute. Defaults suit product cards / grids.
   * @example "(max-width: 1024px) 100vw, 50vw" for PDP hero
   */
  sizes?: string;
  loading?: 'eager' | 'lazy';
  fallbackKind?: DefaultImageKind;
};

const DEFAULT_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px';

export function ProductImage({
  src,
  alt,
  className,
  priority,
  sizes = DEFAULT_SIZES,
  loading,
  fallbackKind = 'product',
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallbackSrc = DEFAULT_IMAGES[fallbackKind];
  const imageSrc = !src || failedSrc === src ? fallbackSrc : src;

  return (
    <span className={cn('relative block aspect-[4/5] w-full overflow-hidden', className)}>
      <Image
        src={imageSrc}
        alt={alt || 'Product image'}
        fill
        sizes={sizes}
        priority={priority}
        quality={85}
        loading={priority ? undefined : loading ?? 'lazy'}
        className="object-cover"
        onError={() => {
          if (src && imageSrc !== fallbackSrc) setFailedSrc(src);
        }}
      />
    </span>
  );
}
