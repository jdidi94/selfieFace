'use client';

import { mediaUrl } from '@/lib/api';
import { trackProductClick } from '@/lib/behavior';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { withMarketLocale } from '@/lib/market-path';
import { getMessages } from '@/lib/messages';
import type { Locale, ProductLabelDto, ProductListItem } from '@lumea/types';
import { MARKET_BY_CURRENCY, ProductKind } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import { ProductCard, type ProductCardLabel } from '@lumea/ui';
import Link from 'next/link';
import { ProductCardActions } from './product-card-actions';
import { WishlistHeartButton } from './wishlist-heart-button';

type ShopItem = Pick<
  ProductListItem,
  | 'id'
  | 'name'
  | 'slug'
  | 'imageUrl'
  | 'priceFrom'
  | 'compareAtFrom'
  | 'packCompareAtFrom'
  | 'currency'
  | 'inStock'
  | 'isIncoming'
  | 'averageRating'
  | 'reviewCount'
  | 'defaultVariantId'
  | 'labels'
  | 'brand'
  | 'kind'
  | 'packItemCount'
>;

function resolveLabels(
  item: ShopItem,
  t: ReturnType<typeof getMessages>,
): ProductCardLabel[] {
  const labels: ProductCardLabel[] = [];
  if (item.kind === ProductKind.PACK) {
    labels.push({ label: t.labelPack, variant: 'accent' });
  }
  if (item.labels?.length) {
    for (const label of item.labels) {
      labels.push(mapLabel(label, t));
    }
    return labels;
  }
  if (item.isIncoming && item.inStock === false) {
    labels.push({ label: t.labelIncoming, variant: 'outline' });
  } else if (item.inStock === false) {
    labels.push({ label: t.outOfStock, variant: 'outline' });
  }
  return labels;
}

function mapLabel(
  label: ProductLabelDto,
  t: ReturnType<typeof getMessages>,
): ProductCardLabel {
  switch (label.kind) {
    case 'incoming':
      return { label: t.labelIncoming, variant: 'outline' };
    case 'promotion':
      return {
        label: label.tag?.trim() || t.labelPromotion,
        variant: 'accent',
      };
    case 'top_rated':
      return { label: t.labelTopRated, variant: 'secondary' };
    case 'out_of_stock':
      return { label: t.outOfStock, variant: 'outline' };
    default:
      return { label: t.labelPromotion, variant: 'secondary' };
  }
}

export function ShopProductGrid({
  items,
  trackClicks = false,
  locale: localeProp,
}: {
  items: ShopItem[];
  trackClicks?: boolean;
  locale?: Locale;
}) {
  const { locale: ctxLocale } = useLocale();
  const { currency } = useCurrency();
  const locale = localeProp ?? ctxLocale;
  const market = MARKET_BY_CURRENCY[currency];
  const t = getMessages(locale);

  return (
    <div className="grid items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const isPack = item.kind === ProductKind.PACK;
        const compare =
          item.packCompareAtFrom != null && item.packCompareAtFrom > item.priceFrom
            ? item.packCompareAtFrom
            : item.compareAtFrom;
        const savings =
          compare != null && compare > item.priceFrom ? compare - item.priceFrom : 0;

        return (
          <div key={item.id} className="flex h-full min-w-0 flex-col">
            <ProductCard
              name={item.name}
              href={withMarketLocale(market, locale, `/products/${item.slug}`)}
              imageUrl={mediaUrl(item.imageUrl)}
              priceFrom={item.priceFrom}
              compareAtFrom={compare}
              currency={item.currency}
              brandName={item.brand?.name}
              brandImageUrl={mediaUrl(item.brand?.imageUrl) ?? item.brand?.imageUrl}
              labels={resolveLabels(item, t)}
              averageRating={item.averageRating}
              reviewCount={item.reviewCount}
              className={item.inStock === false ? 'opacity-80' : undefined}
              favoriteSlot={
                <WishlistHeartButton
                  productId={item.id}
                  className="rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
                />
              }
              actionsSlot={
                <ProductCardActions
                  productId={item.id}
                  variantId={item.defaultVariantId}
                  inStock={item.inStock !== false}
                />
              }
              LinkComponent={({ href, className, children }) => (
                <Link
                  href={href}
                  className={className}
                  onClick={() => {
                    if (trackClicks) trackProductClick(item.id, locale);
                  }}
                >
                  {children}
                </Link>
              )}
            />
            {isPack ? (
              <p className="-mt-1 text-xs text-muted-foreground">
                {item.packItemCount != null && item.packItemCount > 0
                  ? t.packItemCount(item.packItemCount)
                  : t.labelPack}
                {savings > 0 ? ` · ${t.packSaveAmount(formatMoney(savings, item.currency))}` : ''}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
