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
import { LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

function resolveLabels(item: ShopItem, t: ReturnType<typeof getMessages>): ProductCardLabel[] {
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

function mapLabel(label: ProductLabelDto, t: ReturnType<typeof getMessages>): ProductCardLabel {
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
  priorityFirstImage = false,
}: {
  items: ShopItem[];
  trackClicks?: boolean;
  locale?: Locale;
  priorityFirstImage?: boolean;
}) {
  const { locale: ctxLocale } = useLocale();
  const { currency } = useCurrency();
  const locale = localeProp ?? ctxLocale;
  const market = MARKET_BY_CURRENCY[currency];
  const t = getMessages(locale);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const saved = window.localStorage.getItem('selfieface_catalog_view');
    if (saved === 'list' || saved === 'grid') setView(saved);
  }, []);

  function changeView(next: 'grid' | 'list') {
    setView(next);
    window.localStorage.setItem('selfieface_catalog_view', next);
  }

  return (
    <>
      <div className="mb-5 flex justify-end gap-1" role="group" aria-label="Product view">
        <button
          type="button"
          onClick={() => changeView('grid')}
          aria-label="Grid view"
          aria-pressed={view === 'grid'}
          className={`rounded-sm border p-2 ${view === 'grid' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground'}`}
        >
          <LayoutGrid size={18} />
        </button>
        <button
          type="button"
          onClick={() => changeView('list')}
          aria-label="List view"
          aria-pressed={view === 'list'}
          className={`rounded-sm border p-2 ${view === 'list' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground'}`}
        >
          <List size={18} />
        </button>
      </div>
      <div
        className={`grid items-stretch gap-8 ${view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}
      >
        {items.map((item, index) => {
          const isPack = item.kind === ProductKind.PACK;
          const compare =
            item.packCompareAtFrom != null && item.packCompareAtFrom > item.priceFrom
              ? item.packCompareAtFrom
              : item.compareAtFrom;
          const savings =
            compare != null && compare > item.priceFrom ? compare - item.priceFrom : 0;

          return (
            <div
              key={item.id}
              className={`flex h-full min-w-0 ${view === 'list' ? 'gap-4 sm:flex-row' : 'flex-col'}`}
            >
              <ProductCard
                name={item.name}
                href={withMarketLocale(market, locale, `/products/${item.slug}`)}
                imageUrl={mediaUrl(item.imageUrl)}
                imageFallback={item.kind === 'PACK' ? 'pack' : 'product'}
                imagePriority={priorityFirstImage && index === 0}
                priceFrom={item.priceFrom}
                compareAtFrom={compare}
                currency={item.currency}
                locale={locale}
                brandName={item.brand?.name}
                brandImageUrl={mediaUrl(item.brand?.imageUrl) ?? item.brand?.imageUrl}
                labels={resolveLabels(item, t)}
                averageRating={item.averageRating}
                reviewCount={item.reviewCount}
                layout={view}
                className={item.inStock === false || item.isIncoming ? 'opacity-80' : undefined}
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
                    isIncoming={item.isIncoming === true}
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
    </>
  );
}
