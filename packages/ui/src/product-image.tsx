import Image from 'next/image';
import { cn } from './lib/cn';

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
};

const DEFAULT_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px';

export function ProductImage({
  src,
  alt,
  className,
  priority,
  sizes = DEFAULT_SIZES,
  loading,
}: ProductImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex aspect-[4/5] w-full items-center justify-center bg-surface-muted text-sm text-muted-foreground',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        No image
      </div>
    );
  }

  return (
    <span className={cn('relative block aspect-[4/5] w-full overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt || 'Product image'}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading ?? 'lazy'}
        className="object-cover"
      />
    </span>
  );
}
