import { ShopFilterPanel } from '@/components/shop-filter-panel';
import { EmptyCatalogCtas } from '@/components/empty-catalog-ctas';
import { getMessages } from '@/lib/messages';
import { shopFilterQuery, type ShopFilterValues } from '@/lib/shop-filters';
import { ShopProductGrid } from '@/components/shop-product-grid';
import {
  type CatalogBrand,
  type CatalogCategory,
  type ProductListResponse,
} from '@lumea/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import { EmptyState, ErrorState } from '@lumea/ui';
import { BreadcrumbJsonLd } from '@/components/breadcrumb-json-ld';
import { ProductListJsonLd } from '@/components/product-list-json-ld';
import { RetryButton } from '@/components/retry-button';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateStaticParams() {
  const { fetchAllCategorySlugs } = await import('@/lib/static-slugs');
  const slugs = await fetchAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(
  params: Record<string, string | string[] | undefined>,
  categorySlug: string,
): ShopFilterValues {
  const kindRaw = first(params.kind) ?? '';
  return {
    q: first(params.q) ?? '',
    category: categorySlug,
    problemCategory: first(params.problemCategory) ?? '',
    brand: first(params.brand) ?? '',
    kind: kindRaw === 'PRODUCT' || kindRaw === 'PACK' ? kindRaw : '',
    minPrice: first(params.minPrice) ?? '',
    maxPrice: first(params.maxPrice) ?? '',
    minRating: first(params.minRating) ?? '',
    recommended: first(params.recommended) === '1' || first(params.recommended) === 'true',
    incoming: first(params.incoming) === '1' || first(params.incoming) === 'true',
    promotion: first(params.promotion) === '1' || first(params.promotion) === 'true',
    sort: (first(params.sort) as ShopFilterValues['sort']) || '',
    order: first(params.order) === 'desc' ? 'desc' : 'asc',
  };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);

  let category: CatalogCategory | undefined;
  try {
    const categories = await fetchApi<CatalogCategory[]>(
      `/categories?locale=${locale}&currency=${currency}`,
    );
    category = categories.find((c) => c.slug === slug);
  } catch {
    // ignore
  }

  const title = category?.name ?? t.category;
  const description = category?.description ?? t.shopSubtitle(currency);
  const path = `/shop/category/${slug}`;
  const url = localizedAbsoluteUrl(locale, path, market);

  return {
    title,
    description: description || undefined,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title,
      description: description || undefined,
      url,
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default async function CategoryShopPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const page = Number(first(sp.page) ?? '1') || 1;
  const filters = parseFilters(sp, slug);

  let categories: CatalogCategory[] = [];
  let brands: CatalogBrand[] = [];
  try {
    [categories, brands] = await Promise.all([
      fetchApi<CatalogCategory[]>(`/categories?locale=${locale}&currency=${currency}`),
      fetchApi<CatalogBrand[]>(`/brands?locale=${locale}&currency=${currency}`),
    ]);
  } catch {
    notFound();
  }

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const query = shopFilterQuery(filters, page);
  query.set('currency', currency);
  query.set('locale', locale);
  query.set('page', String(page));
  query.set('pageSize', '9');

  let products: ProductListResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 9,
    currency,
    locale,
  };
  let apiDown = false;
  try {
    products = await fetchApi<ProductListResponse>(`/products?${query.toString()}`);
  } catch {
    apiDown = true;
  }

  const totalPages = Math.max(1, Math.ceil(products.total / products.pageSize));
  const pageQuery = (p: number) => {
    const qs = shopFilterQuery(filters, p);
    qs.delete('category');
    return `/shop/category/${slug}?${qs.toString()}`;
  };

  const listingUrl = localizedAbsoluteUrl(locale, `/shop/category/${slug}`, market);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Selfieface', url: localizedAbsoluteUrl(locale, '/', market) },
          { name: t.shop, url: localizedAbsoluteUrl(locale, '/shop', market) },
          { name: category.name, url: listingUrl },
        ]}
      />
      <ProductListJsonLd
        products={products.items}
        url={listingUrl}
        name={category.name}
        locale={locale}
        market={market}
      />
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          {t.shop}
        </Link>
        <span className="mx-2">/</span>
        {category.name}
      </p>
      <div className="mb-10 max-w-xl">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">{category.name}</h1>
        {category.description ? (
          <p className="mt-3 text-muted-foreground">{category.description}</p>
        ) : (
          <p className="mt-3 text-muted-foreground">{t.shopSubtitle(currency)}</p>
        )}
      </div>
      {category.kind !== 'PROBLEM' &&
      categories.some(
        (child) => child.kind === 'PROBLEM' && child.parentCategoryId === category.id,
      ) ? (
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Shop by concern">
          {categories
            .filter((child) => child.kind === 'PROBLEM' && child.parentCategoryId === category.id)
            .map((child) => (
              <Link
                key={child.id}
                href={`/shop/category/${child.slug}`}
                className="rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-foreground hover:text-foreground"
              >
                {child.name}
              </Link>
            ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row">
        <ShopFilterPanel
          values={filters}
          categories={categories.filter((item) => item.kind !== 'PROBLEM')}
          brands={brands}
          action={`/shop/category/${slug}`}
          lockCategory
        />
        <div className="min-w-0 flex-1">
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

          {totalPages > 1 ? (
            <div className="mt-12 flex items-center justify-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageQuery(page - 1)}
                  className="rounded-sm border border-border px-3 py-2 text-sm"
                >
                  {t.previous}
                </Link>
              ) : null}
              <span className="text-sm text-muted-foreground">{t.pageOf(page, totalPages)}</span>
              {page < totalPages ? (
                <Link
                  href={pageQuery(page + 1)}
                  className="rounded-sm border border-border px-3 py-2 text-sm"
                >
                  {t.next}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
