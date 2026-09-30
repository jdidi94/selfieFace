'use client';

import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { ShopPriceFilter } from '@/components/shop-price-filter';
import type { ShopFilterValues } from '@/lib/shop-filters';
import type { CatalogBrand, CatalogCategory, Currency } from '@lumea/types';
import { Button, Input, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@lumea/ui';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

export type { ShopFilterValues };

const BRANDS_PREVIEW = 3;

function filterKey(values: ShopFilterValues) {
  return [
    values.q,
    values.category,
    values.problemCategory,
    values.brand,
    values.minPrice,
    values.maxPrice,
    values.minRating,
    values.recommended ? '1' : '0',
    values.incoming ? '1' : '0',
    values.promotion ? '1' : '0',
    values.sort,
    values.order,
  ].join('|');
}

function FilterFields({
  values,
  categories,
  brands,
  lockCategory,
  brandsExpanded,
  onToggleBrands,
  priceBounds,
  currency,
  t,
}: {
  values: ShopFilterValues;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  lockCategory: boolean;
  brandsExpanded: boolean;
  onToggleBrands: () => void;
  priceBounds: { min: number; max: number };
  currency: string;
  t: ReturnType<typeof getMessages>;
}) {
  const visibleBrands = useMemo(
    () => (brandsExpanded ? brands : brands.slice(0, BRANDS_PREVIEW)),
    [brands, brandsExpanded],
  );

  return (
    <>
      {values.problemCategory ? (
        <input type="hidden" name="problemCategory" value={values.problemCategory} />
      ) : null}
      <p className="text-sm">
        <Link href="/search" className="text-accent underline-offset-2 hover:underline">
          {t.search}
        </Link>
      </p>

      {lockCategory ? (
        <input type="hidden" name="category" value={values.category} />
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{t.category}</span>
          <select
            name="category"
            defaultValue={values.category}
            className="h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm"
          >
            <option value="">{t.all}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-muted-foreground">{t.brand}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="brand" value="" defaultChecked={!values.brand} />
          <span>{t.all}</span>
        </label>
        {visibleBrands.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="brand"
              value={b.slug}
              defaultChecked={values.brand === b.slug}
            />
            {b.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : null}
            <span>{b.name}</span>
          </label>
        ))}
        {brands.length > BRANDS_PREVIEW ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={onToggleBrands}
          >
            {brandsExpanded ? t.showFewerBrands : t.showMoreBrands}
          </button>
        ) : null}
      </fieldset>

      <ShopPriceFilter
        values={values}
        boundsMin={priceBounds.min}
        boundsMax={priceBounds.max || priceBounds.min + 10000}
        currency={currency}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">{t.sortByLabel}</span>
          <select
            name="sort"
            defaultValue={values.sort}
            className="h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm"
          >
            <option value="">{t.all}</option>
            <option value="name">{t.sortName}</option>
            <option value="price">{t.sortPrice}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">{t.sortOrderLabel}</span>
          <select
            name="order"
            defaultValue={values.order}
            className="h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm"
          >
            <option value="asc">{t.sortAsc}</option>
            <option value="desc">{t.sortDesc}</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">{t.minRating}</span>
        <select
          name="minRating"
          defaultValue={values.minRating}
          className="h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm"
        >
          <option value="">{t.anyRating}</option>
          <option value="4">4+</option>
          <option value="3">3+</option>
          <option value="2">2+</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="kind" value="PACK" defaultChecked={values.kind === 'PACK'} />
        {t.packsFilter}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="recommended" value="1" defaultChecked={values.recommended} />
        {t.recommended}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="incoming" value="1" defaultChecked={values.incoming} />
        {t.labelIncoming}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="promotion" value="1" defaultChecked={values.promotion} />
        {t.promotionFilter}
      </label>
    </>
  );
}

function FilterActions({
  action,
  t,
}: {
  action: string;
  t: ReturnType<typeof getMessages>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button type="submit" variant="accent" className="w-full">
        {t.applyFilters}
      </Button>
      <Button type="button" variant="ghost" className="w-full" asChild>
        <a href={action}>{t.clearFilters}</a>
      </Button>
    </div>
  );
}

export function ShopFilterPanel({
  values,
  categories,
  brands,
  action = '/shop',
  lockCategory = false,
  priceBounds = { min: 0, max: 100000 },
  currency = 'USD',
}: {
  values: ShopFilterValues;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  action?: string;
  lockCategory?: boolean;
  priceBounds?: { min: number; max: number };
  currency?: Currency | string;
}) {
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const key = filterKey(values);

  return (
    <>
      <div className="mb-4 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setMobileOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t.filters}
        </Button>
        {/* Mount Sheet only when open — avoids Radix Dialog SSR/hydration mismatches */}
        {mobileOpen ? (
          <Sheet open onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="max-w-sm">
              <SheetHeader>
                <SheetTitle>{t.filterPanel}</SheetTitle>
              </SheetHeader>
              <SheetBody>
                <form
                  key={`mobile-${key}`}
                  method="get"
                  action={action}
                  className="space-y-5"
                  onSubmit={() => setMobileOpen(false)}
                >
                  <FilterFields
                    values={values}
                    categories={categories}
                    brands={brands}
                    lockCategory={lockCategory}
                    brandsExpanded={brandsExpanded}
                    onToggleBrands={() => setBrandsExpanded((v) => !v)}
                    priceBounds={priceBounds}
                    currency={currency}
                    t={t}
                  />
                  <SheetFooter className="border-0 px-0">
                    <FilterActions action={action} t={t} />
                  </SheetFooter>
                </form>
              </SheetBody>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>

      <aside className="hidden w-64 shrink-0 lg:block">
        <form
          key={`desktop-${key}`}
          method="get"
          action={action}
          className="sticky top-24 space-y-5 rounded-sm border border-border bg-surface/60 p-4"
        >
          <h2 className="font-display text-xl">{t.filters}</h2>
          <FilterFields
            values={values}
            categories={categories}
            brands={brands}
            lockCategory={lockCategory}
            brandsExpanded={brandsExpanded}
            onToggleBrands={() => setBrandsExpanded((v) => !v)}
            priceBounds={priceBounds}
            currency={currency}
            t={t}
          />
          <FilterActions action={action} t={t} />
        </form>
      </aside>
    </>
  );
}
