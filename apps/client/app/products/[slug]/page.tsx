import { fetchApi, mediaUrl } from '@/lib/api';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates, seoImages } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import { ProductKind, type ProductDetail, type StoreContactDto } from '@lumea/types';
import { ProductBadge, ProductImage, Rating } from '@lumea/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd } from '@/components/breadcrumb-json-ld';
import { ProductJsonLd } from '@/components/product-json-ld';
import { ProductReviewsSection } from '@/components/product-reviews-section';
import { ProductShareButtons } from '@/components/product-share-buttons';
import { ProductVariantPicker } from '@/components/product-variant-picker';
import { RelatedProductsSection } from '@/components/related-products-section';
import { PackContents } from '@/components/pack-contents';
import { WishlistHeartButton } from '@/components/wishlist-heart-button';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

/** Prebuild known product paths; ISR still refreshes every `revalidate` seconds. */
export async function generateStaticParams() {
  const { fetchAllProductSlugs } = await import('@/lib/static-slugs');
  const slugs = await fetchAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { locale, currency, market } = await getStorefrontWindow();

  let product: ProductDetail | null = null;
  try {
    product = await fetchApi<ProductDetail>(
      `/products/${slug}?currency=${currency}&locale=${locale}`,
    );
  } catch {
    return { title: 'Product' };
  }

  const description = product.shortDescription ?? product.description ?? undefined;
  const path = `/products/${product.slug}`;
  const url = localizedAbsoluteUrl(locale, path, market);
  const image = mediaUrl(product.images[0]?.url);
  const imageAlt = product.images[0]?.alt ?? product.name;
  const images = seoImages(image, imageAlt);

  return {
    title: product.name,
    description,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title: product.name,
      description,
      url,
      siteName: 'Selfieface',
      locale,
      type: 'website',
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);

  let product: ProductDetail | null = null;
  try {
    product = await fetchApi<ProductDetail>(
      `/products/${slug}?currency=${currency}&locale=${locale}`,
    );
  } catch {
    notFound();
  }

  if (!product) notFound();

  let lowStockThreshold = 5;
  try {
    const contact = await fetchApi<StoreContactDto>(
      `/store/contact?currency=${encodeURIComponent(currency)}`,
    );
    if (typeof contact.lowStockThreshold === 'number') {
      lowStockThreshold = contact.lowStockThreshold;
    }
  } catch {
    // API may be unavailable during local setup
  }

  const images = product.images.map((img) => ({
    ...img,
    url: mediaUrl(img.url) ?? img.url,
  }));
  const primary = images[0];
  const defaultVariant =
    product.variants.find((v) => v.isActive && v.stock > 0) ?? product.variants[0];
  const isPack = product.kind === ProductKind.PACK;
  const packPrice = defaultVariant?.price ?? 0;
  const path = `/products/${product.slug}`;
  const canonical = localizedAbsoluteUrl(locale, path, market);
  const breadcrumbs = [
    { name: 'Selfieface', url: localizedAbsoluteUrl(locale, '/', market) },
    { name: t.shop, url: localizedAbsoluteUrl(locale, '/shop', market) },
    {
      name: product.category.name,
      url: localizedAbsoluteUrl(locale, `/shop/category/${product.category.slug}`, market),
    },
    { name: product.name, url: canonical },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <ProductJsonLd product={product} url={canonical} imageUrl={primary?.url} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          {t.shop}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/shop/category/${product.category.slug}`}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
      </p>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <ProductImage
            src={primary?.url}
            alt={primary?.alt ?? product.name}
            className="rounded-md"
            priority
          />
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.map((img) => (
                <ProductImage
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? product.name}
                  className="rounded-sm"
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {isPack ? <ProductBadge label={t.labelPack} variant="accent" /> : null}
            <ProductBadge label={product.brand.name} />
            <ProductBadge label={product.category.name} variant="outline" />
            {product.labels?.map((label) => {
              const text =
                label.kind === 'incoming'
                  ? t.labelIncoming
                  : label.kind === 'promotion'
                    ? label.tag?.trim() || t.labelPromotion
                    : label.kind === 'top_rated'
                      ? t.labelTopRated
                      : t.outOfStock;
              return (
                <ProductBadge
                  key={`${label.kind}-${text}`}
                  label={text}
                  variant={label.kind === 'promotion' ? 'accent' : 'outline'}
                />
              );
            })}
            <WishlistHeartButton
              productId={product.id}
              className="relative right-auto top-auto rounded-full border border-border bg-surface p-2 text-foreground transition hover:bg-surface-muted"
            />
          </div>
          <h1 className="font-display text-4xl text-foreground md:text-5xl">{product.name}</h1>
          {product.averageRating != null && (
            <div className="mt-3">
              <Rating
                value={product.averageRating}
                count={product.reviewCount}
                size="md"
              />
            </div>
          )}
          {product.shortDescription && (
            <p className="mt-4 text-lg text-muted-foreground">{product.shortDescription}</p>
          )}

          <div className="mt-6">
            <ProductVariantPicker
              productId={product.id}
              variants={product.variants}
              currency={product.currency}
              initialVariantId={defaultVariant?.id}
              lowStockThreshold={lowStockThreshold}
              competitorPriceAmount={product.competitorPriceAmount}
              competitorPriceSource={product.competitorPriceSource}
            />
          </div>

          {isPack && product.packComponents?.length ? (
            <PackContents
              components={product.packComponents}
              packPrice={packPrice}
              compareAtFrom={product.packCompareAtFrom}
              savings={product.packSavings}
              currency={product.currency}
            />
          ) : null}

          <div className="mt-6">
            <ProductShareButtons
              title={product.name}
              text={product.shortDescription ?? product.name}
              shareLabel={t.shareProduct}
              copyLabel={t.shareCopy}
              copiedLabel={t.shareCopied}
            />
          </div>
        </div>
      </div>

      <div className="mt-16 grid gap-10 border-t border-border pt-12 md:grid-cols-2">
        {product.description && (
          <section>
            <h2 className="font-display text-2xl">{t.aboutSection}</h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{product.description}</p>
          </section>
        )}
        {product.benefits && (
          <section>
            <h2 className="font-display text-2xl">{t.benefits}</h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{product.benefits}</p>
          </section>
        )}
        {product.howToUse && (
          <section>
            <h2 className="font-display text-2xl">{t.howToUse}</h2>
            <ol className="mt-3 list-decimal space-y-2 ps-5 text-muted-foreground marker:text-foreground">
              {product.howToUse
                .split(/(?:\r?\n|[,،;])+/)
                .map((step) => step.replace(/^\s*(?:(?:\d+)[.)]|[-*•])\s*/, '').trim())
                .filter(Boolean)
                .map((step, index) => (
                  <li key={`${index}-${step.slice(0, 24)}`}>{step}</li>
                ))}
            </ol>
          </section>
        )}
        {product.suitableFor && (
          <section>
            <h2 className="font-display text-2xl">{t.suitableFor}</h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{product.suitableFor}</p>
          </section>
        )}
      </div>

      <ProductReviewsSection
        productSlug={product.slug}
        labels={{
          title: t.reviewsTitle,
          empty: t.reviewsEmpty,
          write: t.reviewsWrite,
          signIn: t.reviewsSignIn,
          pending: t.reviewsPending,
          rejected: t.reviewsRejected,
          submit: t.reviewsSubmit,
          rating: t.reviewsRating,
          reviewTitle: t.reviewsReviewTitle,
          reviewBody: t.reviewsReviewBody,
        }}
      />

      <RelatedProductsSection
        slug={product.slug}
        currency={currency}
        locale={locale}
        title={t.relatedTitle}
      />
    </main>
  );
}
