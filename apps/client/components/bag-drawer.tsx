'use client';

import { FreeShippingProgress } from '@/components/free-shipping-progress';
import { LocaleLink } from '@/components/locale-link';
import { mediaUrl } from '@/lib/api';
import { humanizeCouponError } from '@/lib/coupon-errors';
import { useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useStorefrontPanels } from '@/lib/storefront-panels';
import { formatMoney } from '@lumea/utils';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  ProductImage,
  QuantityStepper,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@lumea/ui';
import { useState, type FormEvent } from 'react';

export function BagDrawer() {
  const { panel, closePanel, openBag } = useStorefrontPanels();
  const {
    cart,
    loading,
    error,
    refresh,
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
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyPending, setLoyaltyPending] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const open = panel === 'bag';

  async function onApplyCoupon(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || couponPending) return;
    setCouponPending(true);
    setCouponError(null);
    try {
      await applyCoupon(code.trim());
      setCode('');
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
    if (loyaltyPending || !cart?.loyalty?.enabled) return;
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
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) openBag();
        else closePanel();
      }}
    >
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t.bagTitle}</SheetTitle>
          <SheetDescription>
            {cart?.itemCount ? t.bagItemCount(cart.itemCount) : t.bagEmptyTitle}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          ) : error ? (
            <ErrorState
              title={t.bagLoadErrorTitle}
              message={t.bagLoadErrorBody}
              className="border-0 bg-transparent py-8"
              action={
                <Button type="button" variant="accent" onClick={() => void refresh()}>
                  {t.errorRetry}
                </Button>
              }
            />
          ) : !cart || cart.items.length === 0 ? (
            <EmptyState
              title={t.bagEmptyTitle}
              description={t.bagEmptyDescription}
              className="border-0 bg-transparent py-8"
              action={
                <Button variant="accent" onClick={() => closePanel()} asChild>
                  <LocaleLink href="/shop">{t.continueShopping}</LocaleLink>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {cart.items.map((item) => (
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
                    <p className="text-xs text-muted-foreground">{item.variantName}</p>
                    <p className="text-sm">{formatMoney(item.unitPrice, cart.currency)}</p>
                    {item.stock <= 0 ? (
                      <p className="text-xs text-destructive">{t.outOfStock}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <QuantityStepper
                        value={item.quantity}
                        min={1}
                        max={Math.max(1, item.stock)}
                        onChange={(qty) => void updateItem(item.id, qty)}
                        decreaseLabel={t.decreaseQty}
                        increaseLabel={t.increaseQty}
                        disabled={item.stock <= 0}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => void removeItem(item.id)}
                      >
                        {t.remove}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
        {cart && cart.items.length > 0 ? (
          <SheetFooter className="space-y-4">
            <FreeShippingProgress
              currency={cart.currency}
              freeShippingThreshold={cart.freeShippingThreshold ?? 0}
              amountUntilFreeShipping={cart.amountUntilFreeShipping ?? 0}
              unlockedLabel={t.freeShippingUnlocked}
              remainingLabel={t.freeShippingRemaining}
            />
            <form className="flex gap-2" onSubmit={(e) => void onApplyCoupon(e)}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t.couponPlaceholder}
                aria-label={t.coupon}
                disabled={couponPending || !!cart.coupon}
              />
              <Button type="submit" variant="outline" disabled={couponPending || !!cart.coupon}>
                {couponPending ? '…' : t.couponApply}
              </Button>
            </form>
            {cart.coupon ? (
              <div className="flex items-center justify-between text-sm">
                <span>
                  {t.couponApplied}: {cart.coupon.code}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void removeCoupon()}>
                  {t.remove}
                </Button>
              </div>
            ) : null}
            {couponError ? <p className="text-sm text-destructive">{couponError}</p> : null}
            {cart.loyalty?.enabled ? (
              <>
                {cart.loyalty.pointsToRedeem > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {t.loyaltyRedeemed(cart.loyalty.pointsToRedeem)} (−
                      {formatMoney(cart.loyalty.discount, cart.currency)})
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => void removeLoyalty()}>
                      {t.loyaltyRedeemRemove}
                    </Button>
                  </div>
                ) : (
                  <form className="flex gap-2" onSubmit={(e) => void onApplyLoyalty(e)}>
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
                  </form>
                )}
                {loyaltyError ? <p className="text-sm text-destructive">{loyaltyError}</p> : null}
              </>
            ) : null}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span>{formatMoney(cart.subtotal, cart.currency)}</span>
              </div>
              {cart.discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.discount}</span>
                  <span>-{formatMoney(cart.discount, cart.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-medium">
                <span>{t.total}</span>
                <span>{formatMoney(cart.total, cart.currency)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" asChild>
                <LocaleLink href="/cart" onClick={closePanel}>
                  {t.viewFullBag}
                </LocaleLink>
              </Button>
              <Button variant="accent" className="flex-1" asChild>
                <LocaleLink href="/checkout" onClick={closePanel}>
                  {t.checkout}
                </LocaleLink>
              </Button>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
