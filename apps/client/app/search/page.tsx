'use client';

import { ShopProductGrid } from '@/components/shop-product-grid';
import { EmptyCatalogCtas } from '@/components/empty-catalog-ctas';
import { fetchApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { CatalogBrand, CatalogCategory, CatalogTaxonomy, ProductListResponse } from '@lumea/types';
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
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy>({ departments: [], productTypes: [], concerns: [], ingredients: [] });
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  // Filter metadata depends on market/language, not each search or page change.
  useEffect(() => {
    const controller = new AbortController();
    const options = { next: { revalidate: 0 }, signal: controller.signal };
    void Promise.all([
      fetchApi<CatalogTaxonomy>(`/taxonomy?locale=${locale}&currency=${currency}`, options),
      fetchApi<CatalogCategory[]>(`/categories?locale=${locale}&currency=${currency}`, options),
      fetchApi<CatalogBrand[]>(`/brands?locale=${locale}&currency=${currency}`, options),
    ]).then(([taxonomyResult, categoryResult, brandResult]) => {
      if (controller.signal.aborted) return;
      setTaxonomy(taxonomyResult);
      setCategories(categoryResult);
      setBrands(brandResult);
    }).catch(() => {});
    return () => controller.abort();
  }, [locale, currency]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!debouncedQ) {
      setData(null);
      setApiDown(false);
      setLoading(false);
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
        next: { revalidate: 0 }, signal,
      });
      if (signal?.aborted) return;
      setData(result);
      setApiDown(false);
    } catch {
      if (signal?.aborted) return;
      setData(null);
      setApiDown(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedQ, currency, locale, page, sort, order]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const term = debouncedQ.toLocaleLowerCase();
  const matches = [
    { label: t.departmentLabel, items: taxonomy.departments.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?department=${encodeURIComponent(item.slug)}` })) },
    { label: t.productTypeLabel, items: taxonomy.productTypes.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?productType=${encodeURIComponent(item.slug)}` })) },
    { label: t.shopByConcern, items: taxonomy.concerns.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?concern=${encodeURIComponent(item.slug)}` })) },
    { label: t.ingredientLabel, items: taxonomy.ingredients.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?ingredient=${encodeURIComponent(item.slug)}` })) },
    { label: t.category, items: categories.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?category=${encodeURIComponent(item.slug)}` })) },
    { label: t.brand, items: brands.filter((item) => item.name.toLocaleLowerCase().includes(term)).map((item) => ({ name: item.name, href: `/shop?brand=${encodeURIComponent(item.slug)}` })) },
  ].filter((group) => group.items.length > 0);

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
              <SelectItem value="name">{t.sortName}</SelectItem>
              <SelectItem value="price">{t.sortPrice}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={order} onValueChange={(v) => setOrder(v as 'asc' | 'desc')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t.sortAsc}</SelectItem>
              <SelectItem value="desc">{t.sortDesc}</SelectItem>
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
      ) : data && (matches.length > 0 || data.items.length > 0) ? (
        <>
          <div className="space-y-6">
            {matches.map((group) => <section key={group.label} aria-label={group.label}><h2 className="mb-2 text-sm font-semibold text-muted-foreground">{group.label}</h2><div className="flex flex-wrap gap-2">{group.items.map((item) => <Link key={`${group.label}-${item.href}`} href={item.href} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-foreground">{item.name}</Link>)}</div></section>)}
            {data.items.length ? <section><h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.shopTitle}</h2><ShopProductGrid items={data.items} trackClicks locale={locale} /><div className="mt-10"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div></section> : null}
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
