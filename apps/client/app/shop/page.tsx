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
  type CatalogTaxonomy,
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
    department: first(params.department) ?? '',
    productType: first(params.productType) ?? '',
    concern: first(params.concern) ?? '',
    ingredient: first(params.ingredient) ?? '',
    category: first(params.category) ?? '',
    problemCategory: first(params.problemCategory) ?? '',
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
  let taxonomy: CatalogTaxonomy = { departments: [], productTypes: [], concerns: [], ingredients: [] };
  let priceBounds: { min: number; max: number; currency: Currency } = {
    min: 0,
    max: 0,
    currency,
  };
  let apiDown = false;

  try {
    [products, categories, brands, priceBounds, taxonomy] = await Promise.all([
      fetchApi<ProductListResponse>(`/products?${query.toString()}`),
      fetchApi<CatalogCategory[]>(`/categories?locale=${locale}&currency=${currency}`),
      fetchApi<CatalogBrand[]>(`/brands?locale=${locale}&currency=${currency}`),
      fetchApi<{ min: number; max: number; currency: Currency }>(
        `/products/catalog/price-range?currency=${currency}`,
      ),
      fetchApi<CatalogTaxonomy>(`/taxonomy?locale=${locale}&currency=${currency}`),
    ]);
  } catch {
    apiDown = true;
  }

  const totalPages = Math.max(1, Math.ceil(products.total / products.pageSize));
  const selectedCategory = categories.find(
    (category) => category.kind !== 'PROBLEM' && category.slug === filters.category,
  );
  const relatedProblems = selectedCategory
    ? categories.filter(
        (category) =>
          category.kind === 'PROBLEM' && category.parentCategoryId === selectedCategory.id,
      )
    : [];
  const selectedCategorySlug = selectedCategory?.slug ?? '';
  const selectedProductType = taxonomy.productTypes.find((item) => item.slug === filters.productType);
  const selectedDepartment = taxonomy.departments.find((item) => item.slug === filters.department)
    ?? taxonomy.departments.find((item) => item.id === selectedProductType?.departmentId);
  const childTypes = selectedDepartment
    ? taxonomy.productTypes.filter((item) => item.departmentId === selectedDepartment.id)
    : [];
  const taxonomyHref = (next: Partial<ShopFilterValues>) => {
    const merged = { ...filters, ...next };
    return `/shop?${shopFilterQuery({ ...merged, productType: next.department !== undefined ? '' : merged.productType, concern: next.department !== undefined || next.productType !== undefined ? '' : merged.concern, ingredient: next.department !== undefined || next.productType !== undefined ? '' : merged.ingredient }).toString()}`;
  };
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

      {taxonomy.departments.length > 0 ? (
        <div className="mb-8 space-y-3">
          {selectedDepartment ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Link href={selectedProductType ? taxonomyHref({ productType: '', concern: '', ingredient: '' }) : taxonomyHref({ department: '', productType: '', concern: '', ingredient: '' })} aria-label={locale === 'ar' ? 'العودة إلى الأقسام' : 'Go back in taxonomy'} className="rounded-full border border-border px-3 py-1.5 hover:text-foreground">← {selectedProductType ? selectedDepartment.name : (locale === 'ar' ? 'الأقسام' : 'All departments')}</Link>
              <span>{selectedDepartment.name}{selectedProductType ? ` / ${selectedProductType.name}` : ''}</span>
            </div>
          ) : null}
          <div className="relative">
            <nav dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex max-w-full snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-2 pe-8 text-sm [scrollbar-width:thin]" aria-label={t.category}>
            {(selectedDepartment ? childTypes : taxonomy.departments).map((item) => (
              <Link
                key={item.id}
                href={selectedDepartment
                  ? taxonomyHref({ productType: item.slug })
                  : (taxonomy.productTypes.some((type) => type.departmentId === item.id)
                    ? taxonomyHref({ department: item.slug })
                    : taxonomyHref({ department: item.slug }))}
                className={`shrink-0 snap-start rounded-full border px-3 py-1.5 transition-colors ${
                  filters.productType === item.slug || filters.department === item.slug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
            </nav>
            <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 end-0 w-8 ${locale === 'ar' ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-background to-transparent`} />
          </div>
          {selectedDepartment && taxonomy.productTypes.length ? (
            <div className="flex max-w-full flex-wrap gap-2 border-s-2 border-accent/30 ps-3">
              {taxonomy.concerns.map((item) => <Link key={`concern-${item.id}`} href={taxonomyHref({ concern: item.slug })} className={`rounded-full border px-3 py-1 text-xs ${filters.concern === item.slug ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>{item.name}</Link>)}
              {taxonomy.ingredients.map((item) => <Link key={`ingredient-${item.id}`} href={taxonomyHref({ ingredient: item.slug })} className={`rounded-full border px-3 py-1 text-xs ${filters.ingredient === item.slug ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>{item.name}</Link>)}
            </div>
          ) : null}
          {relatedProblems.length > 0 ? (
            <nav className="flex flex-wrap items-center gap-2" aria-label={t.shopByConcern}>
              <span className="me-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.shopByConcern}
              </span>
              {relatedProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/shop?category=${encodeURIComponent(selectedCategorySlug)}&problemCategory=${encodeURIComponent(problem.slug)}`}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    filters.problemCategory === problem.slug
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {problem.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row">
        <ShopFilterPanel
          values={filters}
          categories={categories.filter((category) => category.kind !== 'PROBLEM')}
          brands={brands}
          priceBounds={priceBounds}
          currency={currency}
        />
        <div className="min-w-0 flex-1">
          <ShopTagFilters values={filters} taxonomyLabels={[
            ...(selectedDepartment ? [{ key: 'department' as const, label: `${t.departmentLabel}: ${selectedDepartment.name}` }] : []),
            ...(selectedProductType ? [{ key: 'productType' as const, label: `${t.productTypeLabel}: ${selectedProductType.name}` }] : []),
            ...(filters.concern ? [{ key: 'concern' as const, label: `${t.shopByConcern}: ${taxonomy.concerns.find((item) => item.slug === filters.concern)?.name ?? filters.concern}` }] : []),
            ...(filters.ingredient ? [{ key: 'ingredient' as const, label: `${t.ingredientLabel}: ${taxonomy.ingredients.find((item) => item.slug === filters.ingredient)?.name ?? filters.ingredient}` }] : []),
          ]} otherLabels={[
            ...(selectedCategory ? [{ key: 'category' as const, label: `${t.category}: ${selectedCategory.name}` }] : []),
            ...(filters.problemCategory ? [{ key: 'problemCategory' as const, label: `${t.shopByConcern}: ${categories.find((item) => item.slug === filters.problemCategory)?.name ?? filters.problemCategory}` }] : []),
            ...(filters.brand ? [{ key: 'brand' as const, label: `${t.brand}: ${brands.find((item) => item.slug === filters.brand)?.name ?? filters.brand}` }] : []),
          ]} />
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
