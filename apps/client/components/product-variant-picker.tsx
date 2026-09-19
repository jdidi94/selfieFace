'use client';

import { BackInStockForm } from '@/components/back-in-stock-form';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useStorefrontPanels } from '@/lib/storefront-panels';
import type { Currency, ProductVariantDto } from '@lumea/types';
import { Button, ProductPrice, QuantityStepper } from '@lumea/ui';
import { formatMoney } from '@lumea/utils';
import { useCart } from '@/lib/cart-context';
import { useMemo, useState } from 'react';

function stockStatusLabel(
  stock: number,
  lowStockThreshold: number,
  t: ReturnType<typeof getMessages>,
): string | null {
  if (stock <= 0) return t.outOfStock;
  if (stock <= lowStockThreshold) return t.limitedStock;
  return null;
}

export function ProductVariantPicker({
  productId,
  variants,
  currency,
  initialVariantId,
  lowStockThreshold = 5,
}: {
  productId: string;
  variants: ProductVariantDto[];
  currency: Currency | string;
  initialVariantId?: string;
  /** From store settings — show “limited stock” at or below this qty. */
  lowStockThreshold?: number;
}) {
  const { addItem } = useCart();
  const { openBag } = useStorefrontPanels();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const active = useMemo(() => variants.filter((v) => v.isActive), [variants]);
  const [selectedId, setSelectedId] = useState(initialVariantId ?? active[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = active.find((v) => v.id === selectedId) ?? active[0];

  if (!selected) {
    return <p className="text-sm text-muted-foreground">{t.noVariants}</p>;
  }

  const inStock = selected.stock > 0;
  const stockLabel = stockStatusLabel(selected.stock, lowStockThreshold, t);

  async function onAdd() {
    if (!selected || selected.stock <= 0) return;
    setPending(true);
    setMessage(null);
    try {
      await addItem(selected.id, qty);
      setMessage(t.addedToBag);
      openBag();
    } catch (err) {
      setMessage(
        err instanceof Error && err.message.includes('stock')
          ? t.insufficientStock
          : err instanceof Error
            ? err.message
            : t.addToBagError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <ProductPrice
        price={selected.price}
        compareAtPrice={selected.compareAtPrice}
        currency={currency}
        className="text-xl"
      />
      <div>
        <p className="mb-2 text-sm text-muted-foreground">{t.size}</p>
        <div className="flex flex-wrap gap-2">
          {active.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`rounded-sm border px-3 py-2 text-sm ${
                v.id === selected.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-foreground'
              } ${v.stock <= 0 ? 'opacity-40' : ''}`}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
      {stockLabel ? (
        <p
          className={`text-sm ${
            !inStock ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {stockLabel}
        </p>
      ) : null}
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <QuantityStepper
          value={qty}
          max={Math.min(99, Math.max(1, selected.stock))}
          onChange={setQty}
          decreaseLabel={t.decreaseQty}
          increaseLabel={t.increaseQty}
          disabled={pending || !inStock}
        />
        <Button
          variant="accent"
          className="min-w-[10rem] rounded-sm"
          disabled={pending || !inStock}
          onClick={() => void onAdd()}
        >
          {pending ? t.addingToBag : inStock ? t.addToBag : t.outOfStock}
        </Button>
      </div>
      {!inStock && (
        <div className="hidden md:block">
          <BackInStockForm productId={productId} variantId={selected.id} />
        </div>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {formatMoney(selected.price, currency as Currency)}
            </p>
            {stockLabel ? (
              <p
                className={`text-xs ${
                  !inStock ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {stockLabel}
              </p>
            ) : null}
          </div>
          {inStock ? (
            <Button
              variant="accent"
              className="shrink-0 rounded-sm px-5"
              disabled={pending}
              onClick={() => void onAdd()}
            >
              {pending ? t.addingToBag : t.addToBag}
            </Button>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">{t.outOfStock}</span>
          )}
        </div>
        {!inStock && (
          <div className="mx-auto mt-2 max-w-6xl">
            <BackInStockForm productId={productId} variantId={selected.id} compact />
          </div>
        )}
      </div>
      {/* Spacer so sticky bar doesn't cover content */}
      <div className={inStock ? 'h-20 md:hidden' : 'h-40 md:hidden'} aria-hidden />
    </div>
  );
}
