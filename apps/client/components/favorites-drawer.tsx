'use client';

import { LocaleLink } from '@/components/locale-link';
import { apiUrl, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useStorefrontPanels } from '@/lib/storefront-panels';
import type { WishlistItemDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import {
  Button,
  EmptyState,
  ProductImage,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@lumea/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function FavoritesDrawer() {
  const { panel, closePanel, openFavorites, openBag } = useStorefrontPanels();
  const { user, accessToken, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const { locale } = useLocale();
  const { addItem } = useCart();
  const t = getMessages(locale);
  const router = useRouter();
  const [items, setItems] = useState<WishlistItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const open = panel === 'favorites';

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/wishlist?currency=${currency}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setItems([]);
        return;
      }
      setItems((await res.json()) as WishlistItemDto[]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, currency]);

  useEffect(() => {
    if (!open) return;
    if (authLoading) return;
    if (!user) {
      closePanel();
      router.push('/account/login?next=/wishlist');
      return;
    }
    void load();
  }, [open, authLoading, user, closePanel, router, load]);

  async function remove(productId: string) {
    if (!accessToken) return;
    await fetch(`${apiUrl}/wishlist/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await load();
  }

  function addToBag(item: WishlistItemDto) {
    if (!item.defaultVariantId || !item.inStock) return;
    openBag();
    void addItem(item.defaultVariantId, 1).catch(() => {
      // Feedback bar handles error messaging.
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) openFavorites();
        else closePanel();
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t.wishlistTitle}</SheetTitle>
          <SheetDescription>{t.wishlistSubtitle}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {loading || authLoading ? (
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          ) : items.length === 0 ? (
            <EmptyState
              title={t.wishlistEmptyTitle}
              description={t.wishlistEmptyDescription}
              className="border-0 bg-transparent py-8"
              action={
                <Button variant="accent" asChild>
                  <LocaleLink href="/shop" onClick={closePanel}>
                    {t.browseShop}
                  </LocaleLink>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
                    <ProductImage
                      src={mediaUrl(item.imageUrl)}
                      alt={item.productName}
                      className="aspect-auto h-full w-full"
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <LocaleLink
                      href={`/products/${item.productSlug}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                      onClick={closePanel}
                    >
                      {item.productName}
                    </LocaleLink>
                    <p className="text-sm">{formatMoney(item.priceFrom, item.currency)}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.defaultVariantId && item.inStock ? (
                        <Button size="sm" onClick={() => addToBag(item)}>
                          {t.addToBag}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => void remove(item.productId)}
                      >
                        {t.removeFromWishlist}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" className="w-full" asChild>
            <LocaleLink href="/wishlist" onClick={closePanel}>
              {t.viewWishlistPage}
            </LocaleLink>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
