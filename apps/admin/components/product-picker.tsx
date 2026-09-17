'use client';

import { adminFetch } from '@/lib/api';
import type { ProductListItem, ProductListResponse } from '@lumea/types';
import { Button, Input, Label } from '@lumea/ui';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

export type PickedProduct = Pick<ProductListItem, 'id' | 'name' | 'slug'>;

const EMPTY_META: PickedProduct[] = [];

type ProductPickerProps = {
  accessToken: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Optional labels for already-selected ids (e.g. from loaded entity). */
  selectedMeta?: PickedProduct[];
  label?: string;
  max?: number;
  disabled?: boolean;
};

export function ProductPicker({
  accessToken,
  value,
  onChange,
  selectedMeta = EMPTY_META,
  label = 'Products',
  max,
  disabled,
}: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [known, setKnown] = useState<Map<string, PickedProduct>>(() => {
    const map = new Map<string, PickedProduct>();
    for (const p of selectedMeta) map.set(p.id, p);
    return map;
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedMeta.length) return;
    setKnown((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const p of selectedMeta) {
        const existing = next.get(p.id);
        if (!existing || existing.name !== p.name || existing.slug !== p.slug) {
          next.set(p.id, p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedMeta]);

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
          `/admin/products?q=${encodeURIComponent(term)}&limit=20&page=1`,
          accessToken,
        );
        setResults(data.items);
        setKnown((prev) => {
          const next = new Map(prev);
          for (const item of data.items) {
            next.set(item.id, { id: item.id, name: item.name, slug: item.slug });
          }
          return next;
        });
      } catch {
        setResults([]);
        setSearchError('Search failed — try again.');
      } finally {
        setSearching(false);
      }
    },
    [accessToken],
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

  function add(product: ProductListItem) {
    if (value.includes(product.id)) return;
    if (max != null && value.length >= max) return;
    setKnown((prev) => {
      const next = new Map(prev);
      next.set(product.id, { id: product.id, name: product.name, slug: product.slug });
      return next;
    });
    onChange([...value, product.id]);
    setQuery('');
    setResults([]);
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = value.indexOf(id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= value.length) return;
    const next = [...value];
    const tmp = next[idx]!;
    next[idx] = next[nextIdx]!;
    next[nextIdx] = tmp;
    onChange(next);
  }

  function moveToEdge(id: string, edge: 'start' | 'end') {
    const idx = value.indexOf(id);
    if (idx < 0) return;
    if (edge === 'start' && idx === 0) return;
    if (edge === 'end' && idx === value.length - 1) return;
    const next = value.filter((x) => x !== id);
    if (edge === 'start') next.unshift(id);
    else next.push(id);
    onChange(next);
  }

  function onDragStart(id: string) {
    if (disabled) return;
    setDragId(id);
  }

  function onDragOver(e: DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const from = value.indexOf(dragId);
    const to = value.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = [...value];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    onChange(next);
  }

  function onDragEnd() {
    setDragId(null);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, slug, SKU, or id…"
          disabled={disabled || !accessToken}
        />
        <p className="text-xs text-muted-foreground">
          Type to search, then add. Drag rows or use buttons to reorder.
          {max != null ? ` Max ${max}.` : null}
        </p>
      </div>

      {searching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
      {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {results.map((p) => {
            const selected = value.includes(p.id);
            const atMax = max != null && value.length >= max && !selected;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={disabled || selected || atMax}
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
                >
                  <span>
                    {p.name}
                    <span className="ml-2 text-xs text-muted-foreground">{p.slug}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selected ? 'Added' : 'Add'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : query.trim() && !searching && !searchError ? (
        <p className="text-xs text-muted-foreground">No matches.</p>
      ) : null}

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((id, index) => {
            const meta = known.get(id);
            return (
              <li
                key={id}
                draggable={!disabled}
                onDragStart={() => onDragStart(id)}
                onDragOver={(e) => onDragOver(e, id)}
                onDragEnd={onDragEnd}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm ${
                  dragId === id ? 'opacity-60' : ''
                } ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}
              >
                <span>
                  <span className="mr-2 text-xs text-muted-foreground" aria-hidden>
                    ::
                  </span>
                  {index + 1}. {meta?.name ?? id}
                  {meta?.slug ? (
                    <span className="ml-2 text-xs text-muted-foreground">{meta.slug}</span>
                  ) : null}
                </span>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === 0}
                    onClick={() => moveToEdge(id, 'start')}
                    aria-label="Move to top"
                  >
                    Top
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === 0}
                    onClick={() => move(id, -1)}
                    aria-label="Move up"
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === value.length - 1}
                    onClick={() => move(id, 1)}
                    aria-label="Move down"
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || index === value.length - 1}
                    onClick={() => moveToEdge(id, 'end')}
                    aria-label="Move to bottom"
                  >
                    Bottom
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => remove(id)}
                    aria-label="Remove"
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No products selected.</p>
      )}
    </div>
  );
}
