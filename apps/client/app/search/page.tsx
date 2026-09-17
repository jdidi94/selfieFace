'use client';

import { ShopProductGrid } from '@/components/shop-product-grid';
import { EmptyCatalogCtas } from '@/components/empty-catalog-ctas';
import { fetchApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { ProductListResponse } from '@lumea/types';
import { EmptyState, ErrorState, Input, LoadingState, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@lumea/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;

export default function SearchPage() {
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const t = getMessages(locale);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<'price' | 'name'>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    if (!debouncedQ) {
      setData(null);
      setApiDown(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      q: debouncedQ,
      currency,
      locale,
      page: String(page),
      pageSize: '9',
      sort,
      order,
    });
    try {
      const result = await fetchApi<ProductListResponse>(`/products?${params.toString()}`, {
        next: { revalidate: 0 },
      });
      setData(result);
      setApiDown(false);
    } catch {
      setData(null);
      setApiDown(true);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, currency, locale, page, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 max-w-xl space-y-4">
        <h1 className="font-display text-4xl">{t.search}</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          autoFocus
        />
        <div className="flex flex-wrap gap-3">
          <Select value={sort} onValueChange={(v) => setSort(v as 'price' | 'name')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
          <Select value={order} onValueChange={(v) => setOrder(v as 'asc' | 'desc')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/shop" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            {t.footerShop}
          </Link>
        </div>
      </div>

      {!debouncedQ ? (
        <p className="text-sm text-muted-foreground">{t.searchPlaceholder}</p>
      ) : loading ? (
        <LoadingState label={t.search} />
      ) : apiDown ? (
        <ErrorState
          title={t.apiUnavailableTitle}
          message={t.apiUnavailableBody}
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t.errorRetry}
            </button>
          }
        />
      ) : data && data.items.length > 0 ? (
        <>
          <ShopProductGrid items={data.items} trackClicks locale={locale} />
          <div className="mt-10">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      ) : (
        <EmptyState
          title={t.emptySearchTitle}
          description={t.emptySearchBody}
          action={<EmptyCatalogCtas />}
        />
      )}
    </main>
  );
}
