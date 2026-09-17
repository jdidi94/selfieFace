'use client';

import { FreeShippingProgress } from '@/components/free-shipping-progress';
import { LocaleLink } from '@/components/locale-link';
import { mediaUrl } from '@/lib/api';
import { humanizeCouponError } from '@/lib/coupon-errors';
import { useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { formatMoney } from '@lumea/utils';
import { Button, EmptyState, ErrorState, Input, LoadingState, ProductImage, QuantityStepper } from '@lumea/ui';
import { useEffect, useState, type FormEvent } from 'react';

export default function CartPage() {
  const {
    cart,
    loading,
    error,
    refresh,
    stockAdjustments,
    clearStockAdjustments,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
    applyLoyalty,
    removeLoyalty,
  } = useCart();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [code, setCode] = useState('');
  const [couponPending, setCouponPending] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyPending, setLoyaltyPending] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  useEffect(() => {
    if (!stockAdjustments.length) return;
    const timer = window.setTimeout(() => clearStockAdjustments(), 8000);
    return () => window.clearTimeout(timer);
  }, [stockAdjustments, clearStockAdjustments]);

  if (loading) return <LoadingState className="py-24" />;

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-center text-4xl">{t.bagTitle}</h1>
        <div className="mt-10">
          <ErrorState
            title={t.bagLoadErrorTitle}
            message={t.bagLoadErrorBody}
            action={
              <Button type="button" onClick={() => void refresh()}>
                {t.errorRetry}
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-center text-4xl">{t.bagTitle}</h1>
        <div className="mt-10">
          {stockAdjustments.length > 0 ? (
            <p className="mb-4 text-center text-sm text-muted-foreground" role="status">
              {t.bagStockAdjusted}
            </p>
          ) : null}
          <EmptyState
            title={t.bagEmptyTitle}
            description={t.bagEmptyDescription}
            action={
              <Button asChild>
                <LocaleLink href="/shop">{t.continueShopping}</LocaleLink>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  async function onApplyCoupon(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || couponPending) return;
    setCouponPending(true);
    setCouponError(null);
    setCouponSuccess(null);
    try {
      await applyCoupon(code.trim());
      setCode('');
      setCouponSuccess(t.couponAppliedSuccess);
    } catch (err) {
      setCouponError(
        humanizeCouponError(err instanceof Error ? err.message : null, t),
      );
    } finally {
      setCouponPending(false);
    }
  }

  async function onApplyLoyalty(e: FormEvent) {
    e.preventDefault();
    if (loyaltyPending) return;
    const points = Number.parseInt(loyaltyPoints, 10);
    if (!Number.isFinite(points) || points < 0) {
      setLoyaltyError(t.loyaltyError);
      return;
    }
    setLoyaltyPending(true);
    setLoyaltyError(null);
    try {
      await applyLoyalty(points);
      setLoyaltyPoints('');
    } catch (err) {
      setLoyaltyError(err instanceof Error ? err.message : t.loyaltyError);
    } finally {
      setLoyaltyPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl">{t.bagTitle}</h1>
      {stockAdjustments.length > 0 ? (
        <div
          className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium">{t.bagStockAdjusted}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {stockAdjustments.map((adj) => (
              <li key={adj.itemId}>
                {adj.removed
                  ? `${adj.productName}: ${t.bagStockRemoved}`
                  : t.bagQtyReduced(adj.productName, adj.quantity)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="mt-10 divide-y divide-border">
        {cart.items.map((item) => (
          <li key={item.id} className="flex gap-4 py-6">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-surface-muted">
              <ProductImage
                src={mediaUrl(item.imageUrl)}
                alt={item.productName}
                className="aspect-auto h-full w-full"
                sizes="96px"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                <LocaleLink
                  href={`/products/${item.productSlug}`}
                  className="font-medium hover:underline"
                >
                  {item.productName}
                </LocaleLink>
                <p className="text-sm text-muted-foreground">{item.variantName}</p>
                <p className="mt-1 text-sm">
                  {formatMoney(item.unitPrice, cart.currency)}
                </p>
                {item.stock <= 0 ? (
                  <p className="mt-1 text-sm text-destructive">{t.outOfStock}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  value={item.quantity}
                  min={1}
                  max={Math.max(1, item.stock)}
                  onChange={(qty) => void updateItem(item.id, qty)}
                  decreaseLabel={t.decreaseQty}
                  increaseLabel={t.increaseQty}
                  disabled={item.stock <= 0}
                />
                <Button variant="ghost" size="sm" onClick={() => void removeItem(item.id)}>
                  {t.remove}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 border-t border-border pt-6 md:grid-cols-2">
        <div className="space-y-4">
          <FreeShippingProgress
            currency={cart.currency}
            freeShippingThreshold={cart.freeShippingThreshold ?? 0}
            amountUntilFreeShipping={cart.amountUntilFreeShipping ?? 0}
            unlockedLabel={t.freeShippingUnlocked}
            remainingLabel={t.freeShippingRemaining}
          />
          <form onSubmit={onApplyCoupon} className="space-y-3">
            <p className="text-sm font-medium">{t.coupon}</p>
            {cart.coupon ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <span>
                  {t.couponApplied} <span className="font-medium">{cart.coupon.code}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeCoupon()}
                >
                  {t.remove}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t.couponPlaceholder}
                  aria-label={t.coupon}
                  disabled={couponPending}
                />
                <Button type="submit" variant="outline" disabled={couponPending}>
                  {couponPending ? '…' : t.couponApply}
                </Button>
              </div>
            )}
            {couponError ? <p className="text-sm text-destructive">{couponError}</p> : null}
            {couponSuccess ? (
              <p className="text-sm text-muted-foreground">{couponSuccess}</p>
            ) : null}
          </form>

          {cart.loyalty?.enabled ? (
            <form onSubmit={onApplyLoyalty} className="space-y-3">
              <p className="text-sm font-medium">{t.loyalty}</p>
              <p className="text-xs text-muted-foreground">
                {t.loyaltyBalance(cart.loyalty.balance)} ·{' '}
                {t.loyaltyEarnHint(cart.loyalty.pointsPerMajorUnit)}
              </p>
              {cart.loyalty.pointsToRedeem > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <span>
                    {t.loyaltyRedeemed(cart.loyalty.pointsToRedeem)} (−
                    {formatMoney(cart.loyalty.discount, cart.currency)})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeLoyalty()}
                  >
                    {t.loyaltyRedeemRemove}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={cart.loyalty.balance}
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(e.target.value)}
                    placeholder={t.loyaltyRedeemPlaceholder}
                    aria-label={t.loyaltyRedeem}
                    disabled={loyaltyPending || cart.loyalty.balance <= 0}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={loyaltyPending || cart.loyalty.balance <= 0}
                  >
                    {loyaltyPending ? '…' : t.loyaltyRedeemApply}
                  </Button>
                </div>
              )}
              {loyaltyError ? <p className="text-sm text-destructive">{loyaltyError}</p> : null}
            </form>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2 text-sm">
          <p>
            {t.subtotal}{' '}
            <span className="font-medium">{formatMoney(cart.subtotal, cart.currency)}</span>
          </p>
          {cart.discount > 0 && (
            <p className="text-muted-foreground">
              {t.discount} −{formatMoney(cart.discount, cart.currency)}
            </p>
          )}
          <p className="text-lg">
            {t.total}{' '}
            <span className="font-medium">
              {formatMoney(cart.total ?? cart.subtotal - (cart.discount ?? 0), cart.currency)}
            </span>
          </p>
          <Button asChild className="mt-2">
            <LocaleLink href="/checkout">{t.checkout}</LocaleLink>
          </Button>
        </div>
      </div>
    </main>
  );
}
