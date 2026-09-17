import type { ProductDetail } from '@lumea/types';

type ProductJsonLdProps = {
  product: ProductDetail;
  url: string;
  imageUrl?: string | null;
};

export function ProductJsonLd({ product, url, imageUrl }: ProductJsonLdProps) {
  const variant = product.variants.find((v) => v.isActive) ?? product.variants[0];
  const price = variant ? (variant.price / 100).toFixed(2) : undefined;
  const availability = product.variants.some((v) => v.isActive && v.stock > 0)
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

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
    offers: price
      ? {
          '@type': 'Offer',
          url,
          priceCurrency: product.currency,
          price,
          availability,
        }
      : undefined,
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
