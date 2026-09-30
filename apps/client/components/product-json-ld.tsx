import type { ProductDetail } from '@lumea/types';

type ProductJsonLdProps = {
  product: ProductDetail;
  url: string;
  imageUrl?: string | null;
};

export function ProductJsonLd({ product, url, imageUrl }: ProductJsonLdProps) {
  const variant =
    product.variants.find((v) => v.isActive && v.stock > 0) ??
    product.variants.find((v) => v.isActive) ??
    product.variants[0];
  const price =
    variant && typeof variant.price === 'number'
      ? (variant.price / 100).toFixed(2)
      : undefined;
  const priceCurrency = variant?.currency ?? product.currency;
  const inStock = product.variants.some((v) => v.isActive && v.stock > 0);
  const availability = inStock
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const offers =
    price && priceCurrency
      ? {
          '@type': 'Offer' as const,
          url,
          priceCurrency,
          price,
          availability,
          itemCondition: 'https://schema.org/NewCondition',
        }
      : undefined;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    image: imageUrl ? [imageUrl] : undefined,
    sku: variant?.sku,
    brand: product.brand?.name
      ? { '@type': 'Brand', name: product.brand.name }
      : undefined,
    offers,
    ...(product.reviewCount && product.averageRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.averageRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
