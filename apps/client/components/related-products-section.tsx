import { fetchApi, mediaUrl } from '@/lib/api';
import { ShopProductGrid } from '@/components/shop-product-grid';
import { ProductListJsonLd } from '@/components/product-list-json-ld';
import { localizedAbsoluteUrl } from '@/lib/seo';
import { marketFromCurrency } from '@/lib/market-path';
import type { Currency, Locale, ProductListItem } from '@lumea/types';

type RelatedProductsSectionProps = {
  slug: string;
  currency: Currency;
  locale: Locale;
  title: string;
};

export async function RelatedProductsSection({
  slug,
  currency,
  locale,
  title,
}: RelatedProductsSectionProps) {
  let items: ProductListItem[] = [];
  try {
    items = await fetchApi<ProductListItem[]>(
      `/products/${encodeURIComponent(slug)}/related?currency=${currency}&locale=${locale}&limit=4`,
    );
  } catch {
    return null;
  }

  if (!items.length) return null;

  const resolved = items.map((item) => ({
    ...item,
    imageUrl: mediaUrl(item.imageUrl) ?? item.imageUrl,
  }));
  const market = marketFromCurrency(currency);

  return (
    <section className="mt-16 border-t border-border pt-12">
      <ProductListJsonLd
        products={resolved}
        url={localizedAbsoluteUrl(locale, `/products/${slug}`, market)}
        name={title}
        locale={locale}
        market={market}
      />
      <h2 className="font-display text-3xl">{title}</h2>
      <div className="mt-8">
        <ShopProductGrid items={resolved} trackClicks locale={locale} />
      </div>
    </section>
  );
}
