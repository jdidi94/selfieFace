'use client';

import { LocaleLink } from '@/components/locale-link';
import { apiUrl, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { WishlistItemDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import { Button, EmptyState, LoadingState, ProductImage } from '@lumea/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function WishlistPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [items, setItems] = useState<WishlistItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch(`${apiUrl}/wishlist?currency=${currency}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      setItems([]);
      return;
    }
    setItems((await res.json()) as WishlistItemDto[]);
  }, [accessToken, currency]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/account/login?next=/wishlist');
      return;
    }
    void load().finally(() => setLoading(false));
  }, [authLoading, user, router, load]);

  async function remove(productId: string) {
    if (!accessToken) return;
    await fetch(`${apiUrl}/wishlist/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await load();
  }

  if (authLoading || loading) return <LoadingState className="py-24" />;
  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl">{t.wishlistTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.wishlistSubtitle}</p>

      {items.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title={t.wishlistEmptyTitle}
            description={t.wishlistEmptyDescription}
            action={
              <Button asChild>
                <LocaleLink href="/shop">{t.browseShop}</LocaleLink>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 py-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                <ProductImage
                  src={mediaUrl(item.imageUrl)}
                  alt={item.productName}
                  className="aspect-auto h-full w-full"
                  sizes="96px"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <LocaleLink
                    href={`/products/${item.productSlug}`}
                    className="font-medium hover:underline"
                  >
                    {item.productName}
                  </LocaleLink>
                  <p className="mt-1 text-sm">
                    {formatMoney(item.priceFrom, item.currency)}
                    {!item.inStock && (
                      <span className="ms-2 text-muted-foreground">{t.outOfStock}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/products/${item.productSlug}`}>{t.view}</LocaleLink>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove(item.productId)}
                  >
                    {t.remove}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
