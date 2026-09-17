import type { ReactNode } from 'react';
import { ProductBadge } from './product-badge';
import { ProductImage } from './product-image';
import { ProductPrice } from './product-price';
import { Rating } from './rating';
import { cn } from './lib/cn';

export type ProductCardLabel = {
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'accent';
};

export type ProductCardProps = {
  name: string;
  href: string;
  imageUrl?: string | null;
  priceFrom: number;
  compareAtFrom?: number | null;
  currency?: string;
  /** @deprecated Prefer `labels` */
  badge?: string | null;
  labels?: ProductCardLabel[];
  brandName?: string | null;
  brandImageUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  favoriteSlot?: ReactNode;
  actionsSlot?: ReactNode;
  className?: string;
  LinkComponent?: (props: { href: string; className?: string; children: ReactNode }) => ReactNode;
};

export function ProductCard({
  name,
  href,
  imageUrl,
  priceFrom,
  compareAtFrom,
  currency = 'USD',
  badge,
  labels,
  brandName,
  brandImageUrl,
  averageRating,
  reviewCount,
  favoriteSlot,
  actionsSlot,
  className,
  LinkComponent,
}: ProductCardProps) {
  const resolvedLabels: ProductCardLabel[] =
    labels && labels.length
      ? labels
      : badge
        ? [{ label: badge, variant: 'secondary' }]
        : [];

  const Link = LinkComponent ?? ((props) => <a {...props} />);

  return (
    <article className={cn('group flex h-full min-w-0 flex-col', className)}>
      <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-sm bg-surface-muted">
        <Link href={href} className="absolute inset-0 block">
          <ProductImage
            src={imageUrl}
            alt={name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            className="absolute inset-0 aspect-auto h-full w-full max-h-none"
          />
        </Link>
        {resolvedLabels.length > 0 && (
          <div className="pointer-events-none absolute start-3 top-3 z-[1] flex max-w-[70%] flex-wrap gap-1.5">
            {resolvedLabels.map((item) => (
              <ProductBadge
                key={item.label}
                label={item.label}
                variant={item.variant ?? 'secondary'}
                className="max-w-full truncate rounded-sm shadow-sm"
              />
            ))}
          </div>
        )}
        {favoriteSlot ? <div className="absolute end-3 top-3 z-[2]">{favoriteSlot}</div> : null}
      </div>

      <div className="mt-3 flex min-w-0 flex-1 flex-col gap-2">
        {brandName ? (
          <div className="flex min-w-0 items-center gap-2">
            {brandImageUrl ? (
              <img
                src={brandImageUrl}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-foreground"
              >
                {brandName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-xs tracking-wide text-muted-foreground uppercase">
              {brandName}
            </span>
          </div>
        ) : null}

        <Link href={href} className="block min-w-0">
          <h3 className="line-clamp-2 font-display text-lg leading-snug text-foreground transition-colors group-hover:text-foreground/80">
            {name}
          </h3>
        </Link>

        {averageRating != null && (
          <div className="min-w-0 truncate">
            <Rating value={averageRating} count={reviewCount} size="sm" />
          </div>
        )}

        <div className="min-w-0 truncate">
          <ProductPrice
            price={priceFrom}
            compareAtPrice={compareAtFrom}
            currency={currency}
            className="text-sm"
          />
        </div>

        {actionsSlot ? <div className="mt-auto min-w-0 pt-2">{actionsSlot}</div> : null}
      </div>
    </article>
  );
}
