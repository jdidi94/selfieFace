'use client';

import { adminFetch } from '@/lib/api';
import type { CatalogBrand } from '@lumea/types';
import { Input, Label } from '@lumea/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

type BrandPickerProps = {
  accessToken: string | null;
  value: string;
  onChange: (brandId: string) => void;
  onSelectBrand?: (brand: CatalogBrand) => void;
  /** Preloaded brand for edit mode so the label shows before search. */
  initialBrand?: CatalogBrand | null;
  label?: string;
  disabled?: boolean;
  required?: boolean;
};

export function BrandPicker({
  accessToken,
  value,
  onChange,
  onSelectBrand,
  initialBrand = null,
  label = 'Brand',
  disabled,
  required,
}: BrandPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogBrand[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CatalogBrand | null>(initialBrand);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialBrand) setSelected(initialBrand);
  }, [initialBrand]);

  const search = useCallback(
    async (q: string) => {
      if (!accessToken) return;
      const term = q.trim();
      if (!term) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await adminFetch<CatalogBrand[]>(
          `/admin/brands?q=${encodeURIComponent(term)}&limit=20`,
          accessToken,
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search, open]);

  function pick(brand: CatalogBrand) {
    setSelected(brand);
    onChange(brand.id);
    onSelectBrand?.(brand);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span>
            {selected.name}
            <span className="ml-2 text-xs text-muted-foreground">{selected.slug}</span>
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            disabled={disabled}
            onClick={() => {
              setOpen(true);
              setQuery('');
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {required ? 'Select a brand (required).' : 'No brand selected.'}
        </p>
      )}

      {(open || !selected) && (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search brands by name, slug, or id…"
            disabled={disabled || !accessToken}
          />
          {searching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
          {results.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {results.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(b)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
                  >
                    <span>
                      {b.name}
                      <span className="ml-2 text-xs text-muted-foreground">{b.slug}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() && !searching ? (
            <p className="text-xs text-muted-foreground">No brands found.</p>
          ) : null}
        </div>
      )}

      {/* Keep value in form for native required semantics when needed */}
      <input type="hidden" value={value} required={required} readOnly />
    </div>
  );
}
