import type { Locale, MarketCode, ProductListItem } from '@lumea/types';
import { MarketCode as MarketCodes } from '@lumea/types';
import { mediaUrl } from '@/lib/api';
import { localizedAbsoluteUrl } from '@/lib/seo';

type ProductListJsonLdProps = {
  products: ProductListItem[];
  /** Absolute URL of the listing page */
  url: string;
  name: string;
  locale: Locale;
  market?: MarketCode;
};

/**
 * ItemList JSON-LD for shop / category product grids.
 * Each entry is a Product with Offer when price is available.
 */
export function ProductListJsonLd({
  products,
  url,
  name,
  locale,
  market = MarketCodes.OTHER,
}: ProductListJsonLdProps) {
  if (!products.length) return null;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => {
      const productPageUrl = localizedAbsoluteUrl(
        locale,
        `/products/${product.slug}`,
        market,
      );
      const image = mediaUrl(product.imageUrl);
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Product',
          name: product.name,
          url: productPageUrl,
          image: image ? [image] : undefined,
          description: product.shortDescription ?? undefined,
          brand: product.brand?.name
            ? { '@type': 'Brand', name: product.brand.name }
            : undefined,
          offers: {
            '@type': 'Offer',
            url: productPageUrl,
            priceCurrency: product.currency,
            price: (product.priceFrom / 100).toFixed(2),
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        },
      };
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
