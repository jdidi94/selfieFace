'use client';

import { BackInStockForm } from '@/components/back-in-stock-form';
import { useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useStorefrontPanels } from '@/lib/storefront-panels';
import { Button, QuantityStepper } from '@lumea/ui';
import { useState } from 'react';

export function ProductCardActions({
  productId,
  variantId,
  inStock,
}: {
  productId: string;
  variantId?: string | null;
  inStock: boolean;
}) {
  const { addItem } = useCart();
  const { openBag } = useStorefrontPanels();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [showNotify, setShowNotify] = useState(false);

  async function onAdd() {
    if (!variantId || !inStock) return;
    setPending(true);
    try {
      await addItem(variantId, qty);
      openBag();
    } finally {
      setPending(false);
    }
  }

  if (!inStock) {
    return (
      <div className="space-y-2">
        {!showNotify ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowNotify(true)}
          >
            {t.notifyStockCta}
          </Button>
        ) : (
          <BackInStockForm productId={productId} variantId={variantId} compact />
        )}
      </div>
    );
  }

  if (!variantId) {
    return (
      <Button variant="outline" className="w-full" disabled>
        {t.outOfStock}
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <QuantityStepper
        value={qty}
        onChange={setQty}
        decreaseLabel={t.decreaseQty}
        increaseLabel={t.increaseQty}
        disabled={pending}
      />
      <Button
        variant="accent"
        className="min-w-0 flex-1 truncate rounded-sm"
        disabled={pending}
        onClick={() => void onAdd()}
      >
        {pending ? t.addingToBag : t.addToBag}
      </Button>
    </div>
  );
}
