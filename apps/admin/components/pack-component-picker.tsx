'use client';

import { adminFetch } from '@/lib/api';
import type { ProductDetail, ProductListItem, ProductListResponse } from '@lumea/types';
import { ProductKind } from '@lumea/types';
import { Button, Input, Label } from '@lumea/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PackComponentSelection = {
  variantId: string;
  quantity: number;
  productId: string;
  productName: string;
  variantName: string;
  variantSku: string;
};

type PackComponentPickerProps = {
  accessToken: string | null;
  value: PackComponentSelection[];
  onChange: (next: PackComponentSelection[]) => void;
  /** Exclude this product (the pack being edited) from search. */
  excludeProductId?: string | null;
  disabled?: boolean;
};

export function PackComponentPicker({
  accessToken,
  value,
  onChange,
  excludeProductId,
  disabled,
}: PackComponentPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [variantChoices, setVariantChoices] = useState<
    { id: string; name: string; sku: string; productId: string; productName: string }[]
  >([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!accessToken) return;
      const term = q.trim();
      if (!term) {
        setResults([]);
        setSearchError(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const data = await adminFetch<ProductListResponse>(
          `/admin/products?q=${encodeURIComponent(term)}&kind=PRODUCT&limit=20&page=1`,
          accessToken,
        );
        setResults(
          data.items.filter(
            (item) => item.id !== excludeProductId && item.kind !== ProductKind.PACK,
          ),
        );
      } catch {
        setResults([]);
        setSearchError('Search failed — try again.');
      } finally {
        setSearching(false);
      }
    },
    [accessToken, excludeProductId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  function addVariant(row: Omit<PackComponentSelection, 'quantity'>, quantity = 1) {
    if (value.some((v) => v.variantId === row.variantId)) return;
    onChange([...value, { ...row, quantity }]);
    setQuery('');
    setResults([]);
    setVariantChoices([]);
    setPendingProductId(null);
  }

  async function pickProduct(product: ProductListItem) {
    if (!accessToken || disabled) return;
    setPendingProductId(product.id);
    try {
      const detail = await adminFetch<ProductDetail>(
        `/admin/products/${product.id}`,
        accessToken,
      );
      const active = detail.variants.filter((v) => v.isActive);
      const choices = (active.length ? active : detail.variants).map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        productId: detail.id,
        productName: detail.name,
      }));
      if (choices.length === 1) {
        const only = choices[0]!;
        addVariant({
          variantId: only.id,
          productId: only.productId,
          productName: only.productName,
          variantName: only.name,
          variantSku: only.sku,
        });
        return;
      }
      setVariantChoices(choices);
    } catch {
      setSearchError('Could not load product variants.');
      setPendingProductId(null);
    }
  }

  function setQty(variantId: string, quantity: number) {
    const nextQty = Math.max(1, Math.min(99, quantity));
    onChange(value.map((row) => (row.variantId === variantId ? { ...row, quantity: nextQty } : row)));
  }

  function remove(variantId: string) {
    onChange(value.filter((row) => row.variantId !== variantId));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <Label htmlFor="pack-component-search">Pack components</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Search catalog products and add variants. Pack price is set below; storefront shows
          savings vs buying items separately.
        </p>
      </div>

      <Input
        id="pack-component-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products to add…"
        disabled={disabled || !accessToken}
        autoComplete="off"
      />

      {searching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
      {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-48 overflow-auto rounded-md border border-border divide-y divide-border">
          {results.map((item) => {
            const already = value.some((v) => v.productId === item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-surface-muted disabled:opacity-50"
                  disabled={disabled || pendingProductId === item.id}
                  onClick={() => void pickProduct(item)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.slug}
                      {already ? ' · already in pack' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {pendingProductId === item.id ? '…' : 'Add'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {variantChoices.length > 1 ? (
        <div className="rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium text-foreground">Choose a variant</p>
          <ul className="mt-2 space-y-1">
            {variantChoices.map((v) => (
              <li key={v.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  disabled={disabled || value.some((row) => row.variantId === v.id)}
                  onClick={() =>
                    addVariant({
                      variantId: v.id,
                      productId: v.productId,
                      productName: v.productName,
                      variantName: v.name,
                      variantSku: v.sku,
                    })
                  }
                >
                  {v.name} · {v.sku}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setVariantChoices([]);
              setPendingProductId(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No components yet — add at least one product.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((row) => (
            <li
              key={row.variantId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.variantName} · {row.variantSku}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Qty
                <Input
                  type="number"
                  min={1}
                  max={99}
                  className="h-8 w-16"
                  value={row.quantity}
                  disabled={disabled}
                  onChange={(e) => setQty(row.variantId, Number(e.target.value) || 1)}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => remove(row.variantId)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
