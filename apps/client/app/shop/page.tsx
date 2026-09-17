import { ShopFilterPanel } from '@/components/shop-filter-panel';
import { SearchBehaviorBeacon } from '@/components/search-behavior-beacon';
import { ShopProductGrid } from '@/components/shop-product-grid';
import { ShopTagFilters } from '@/components/shop-tag-filters';
import { EmptyCatalogCtas } from '@/components/empty-catalog-ctas';
import { getMessages } from '@/lib/messages';
import { shopFilterQuery, type ShopFilterValues } from '@/lib/shop-filters';
import {
  type CatalogBrand,
  type CatalogCategory,
  type Currency,
  type ProductListResponse,
} from '@lumea/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import { EmptyState, ErrorState } from '@lumea/ui';
import { BreadcrumbJsonLd } from '@/components/breadcrumb-json-ld';
import { ProductListJsonLd } from '@/components/product-list-json-ld';
import { RetryButton } from '@/components/retry-button';

export const revalidate = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): ShopFilterValues {
  const kindRaw = first(params.kind) ?? '';
  return {
    q: first(params.q) ?? '',
    category: first(params.category) ?? '',
    brand: first(params.brand) ?? '',
    kind: kindRaw === 'PRODUCT' || kindRaw === 'PACK' ? kindRaw : '',
    minPrice: first(params.minPrice) ?? '',
    maxPrice: first(params.maxPrice) ?? '',
    minRating: first(params.minRating) ?? '',
    recommended: first(params.recommended) === '1' || first(params.recommended) === 'true',
    incoming: first(params.incoming) === '1' || first(params.incoming) === 'true',
    promotion: first(params.promotion) === '1' || first(params.promotion) === 'true',
    sort: (first(params.sort) === 'price' || first(params.sort) === 'name'
      ? first(params.sort)
      : '') as ShopFilterValues['sort'],
    order: first(params.order) === 'desc' ? 'desc' : 'asc',
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const filters = parseFilters(params);
  const title = filters.q ? `${t.search}: ${filters.q}` : t.shopTitle;
  const description = t.shopSubtitle(currency);
  const path = '/shop';
  const url = localizedAbsoluteUrl(locale, path, market);

  return {
    title,
    description,
    alternates: seoAlternates(path, locale, market),
    openGraph: { title, description, url, siteName: 'Selfieface', locale, type: 'website' },
  };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const filters = parseFilters(params);
  const page = Number(first(params.page) ?? '1') || 1;

  const query = shopFilterQuery(filters, page);
  query.set('currency', currency);
  query.set('locale', locale);
  query.set('page', String(page));
  query.set('pageSize', '9');
  if (filters.sort) query.set('sort', filters.sort);
  if (filters.order) query.set('order', filters.order);

  let products: ProductListResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 9,
    currency,
    locale,
  };
  let categories: CatalogCategory[] = [];
  let brands: CatalogBrand[] = [];
  let priceBounds: { min: number; max: number; currency: Currency } = {
    min: 0,
    max: 0,
    currency,
  };
  let apiDown = false;

  try {
    [products, categories, brands, priceBounds] = await Promise.all([
      fetchApi<ProductListResponse>(`/products?${query.toString()}`),
      fetchApi<CatalogCategory[]>(`/categories?locale=${locale}&currency=${currency}`),
      fetchApi<CatalogBrand[]>(`/brands?locale=${locale}&currency=${currency}`),
      fetchApi<{ min: number; max: number; currency: Currency }>(
        `/products/catalog/price-range?currency=${currency}`,
      ),
    ]);
  } catch {
    apiDown = true;
  }

  const totalPages = Math.max(1, Math.ceil(products.total / products.pageSize));
  const pageQuery = (p: number) => {
    const qs = shopFilterQuery(filters, p);
    return `/shop?${qs.toString()}`;
  };

  const listingUrl = localizedAbsoluteUrl(locale, '/shop', market);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Selfieface', url: localizedAbsoluteUrl(locale, '/', market) },
          { name: t.shop, url: listingUrl },
        ]}
      />
      <ProductListJsonLd
        products={products.items}
        url={listingUrl}
        name={t.shopTitle}
        locale={locale}
        market={market}
      />
      <SearchBehaviorBeacon query={filters.q} locale={locale} />
      <div className="mb-10 max-w-xl">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">{t.shopTitle}</h1>
        <p className="mt-3 text-muted-foreground">{t.shopSubtitle(currency)}</p>
      </div>

      {categories.length > 0 ? (
        <nav className="mb-8 flex flex-wrap gap-3 text-sm" aria-label={t.category}>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/shop?category=${encodeURIComponent(c.slug)}`}
              className={`underline-offset-4 hover:text-foreground hover:underline ${
                filters.category === c.slug ? 'text-foreground underline' : 'text-muted-foreground'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row">
        <ShopFilterPanel
          values={filters}
          categories={categories}
          brands={brands}
          priceBounds={priceBounds}
          currency={currency}
        />
        <div className="min-w-0 flex-1">
          <ShopTagFilters values={filters} />
          {apiDown ? (
            <ErrorState
              title={t.apiUnavailableTitle}
              message={t.apiUnavailableBody}
              action={<RetryButton label={t.errorRetry} />}
            />
          ) : products.items.length === 0 ? (
            <EmptyState
              title={t.emptyFilterTitle}
              description={t.emptyFilterBody}
              action={<EmptyCatalogCtas showClearFilters />}
            />
          ) : (
            <ShopProductGrid items={products.items} trackClicks locale={locale} />
          )}

          {totalPages > 1 && (
            <div className="mt-12">
              <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
                {page > 1 && (
                  <Link href={pageQuery(page - 1)} className="rounded-sm border border-border px-3 py-2 text-sm">
                    {t.previous}
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">{t.pageOf(page, totalPages)}</span>
                {page < totalPages && (
                  <Link href={pageQuery(page + 1)} className="rounded-sm border border-border px-3 py-2 text-sm">
                    {t.next}
                  </Link>
                )}
              </nav>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
