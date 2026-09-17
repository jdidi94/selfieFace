import type {
  BrandTranslationDto,
  CatalogBrand,
  CatalogCategory,
  CategoryTranslationDto,
  Currency,
  Locale,
  MarketCode,
  PackComponentDto,
  ProductDetail,
  ProductImageDto,
  ProductLabelDto,
  ProductListItem,
  ProductTranslationDto,
  ProductVariantDto,
  VariantPriceDto,
} from '@lumea/types';
import {
  Currency as SharedCurrency,
  Locale as SharedLocale,
  MarketCode as SharedMarketCode,
  ProductKind as SharedProductKind,
  ProductStatus as SharedProductStatus,
} from '@lumea/types';
import type {
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Market,
  Media,
  PackComponent,
  Product,
  ProductImage,
  ProductTranslation,
  ProductVariant,
  Promotion,
  PromotionProduct,
  VariantPrice,
} from '@prisma/client';

type VariantWithPrices = ProductVariant & { prices: VariantPrice[] };

type CategoryWithTranslations = Category & { translations?: CategoryTranslation[] };
type BrandWithTranslations = Brand & { translations?: BrandTranslation[] };

type ActivePromotionLink = PromotionProduct & { promotion: Promotion };

type PackComponentWithVariant = PackComponent & {
  variant: VariantWithPrices & {
    product: Product & {
      images?: (ProductImage & { media: Media })[];
      translations?: ProductTranslation[];
    };
  };
};

type ProductWithRelations = Product & {
  category: CategoryWithTranslations;
  brand: BrandWithTranslations;
  market?: Pick<Market, 'code'> | null;
  variants: VariantWithPrices[];
  images: (ProductImage & { media: Media })[];
  translations?: ProductTranslation[];
  promotionProducts?: ActivePromotionLink[];
  packComponents?: PackComponentWithVariant[];
};

function pickTranslation<T extends { locale: string }>(
  translations: T[] | undefined,
  locale: SharedLocale,
): T | undefined {
  if (!translations?.length) return undefined;
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === SharedLocale.EN) ??
    translations[0]
  );
}

export function isPromotionWindowActive(
  promotion: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>,
  now = new Date(),
) {
  if (!promotion.isActive) return false;
  if (promotion.startsAt && promotion.startsAt > now) return false;
  if (promotion.endsAt && promotion.endsAt < now) return false;
  return true;
}

export function activePromotionWhere(now = new Date()) {
  return {
    isActive: true as const,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

export function mapCategory(
  c: CategoryWithTranslations,
  locale: SharedLocale = SharedLocale.EN,
  includeAll = false,
): CatalogCategory {
  const t = pickTranslation(c.translations, locale);
  const translations: CategoryTranslationDto[] | undefined = includeAll
    ? (c.translations ?? []).map((row) => ({
        locale: row.locale as Locale,
        name: row.name,
        description: row.description,
      }))
    : undefined;

  return {
    id: c.id,
    name: t?.name ?? c.name,
    slug: c.slug,
    description: t?.description ?? c.description,
    locale,
    translations,
  };
}

export function mapBrand(
  b: BrandWithTranslations,
  locale: SharedLocale = SharedLocale.EN,
  includeAll = false,
): CatalogBrand {
  const t = pickTranslation(b.translations, locale);
  const translations: BrandTranslationDto[] | undefined = includeAll
    ? (b.translations ?? []).map((row) => ({
        locale: row.locale as Locale,
        name: row.name,
        description: row.description,
      }))
    : undefined;

  return {
    id: b.id,
    name: t?.name ?? b.name,
    slug: b.slug,
    description: t?.description ?? b.description,
    imageUrl: b.imageUrl ?? null,
    locale,
    translations,
  };
}

function pickPrice(
  prices: VariantPrice[],
  currency: SharedCurrency,
): { amount: number; compareAtAmount: number | null } {
  const match =
    prices.find((p) => p.currency === currency) ??
    prices.find((p) => p.currency === 'USD') ??
    prices[0];
  return {
    amount: match?.amount ?? 0,
    compareAtAmount: match?.compareAtAmount ?? null,
  };
}

export function mapVariant(
  v: VariantWithPrices,
  currency: SharedCurrency = SharedCurrency.USD,
): ProductVariantDto {
  const selected = pickPrice(v.prices, currency);
  const prices: VariantPriceDto[] = v.prices.map((p) => ({
    currency: p.currency as Currency,
    amount: p.amount,
    compareAtAmount: p.compareAtAmount,
  }));

  return {
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: selected.amount,
    compareAtPrice: selected.compareAtAmount,
    currency,
    prices,
    stock: v.stock,
    weightGrams: v.weightGrams,
    barcode: v.barcode,
    isActive: v.isActive,
  };
}

export function mapImages(
  images: (ProductImage & { media: Media })[],
): ProductImageDto[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      id: img.id,
      mediaId: img.mediaId,
      url: img.media.url,
      alt: img.alt,
      sortOrder: img.sortOrder,
    }));
}

function packAvailableQty(components: PackComponentWithVariant[] | undefined): number | null {
  if (!components?.length) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const c of components) {
    const perPack = Math.max(1, c.quantity);
    const available = Math.floor(c.variant.stock / perPack);
    min = Math.min(min, available);
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

function mapPackComponents(
  components: PackComponentWithVariant[] | undefined,
  currency: SharedCurrency,
  locale: SharedLocale,
): PackComponentDto[] {
  if (!components?.length) return [];
  return [...components]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const unit = pickPrice(c.variant.prices, currency).amount;
      const productT = pickTranslation(c.variant.product.translations, locale);
      const images = c.variant.product.images ? mapImages(c.variant.product.images) : [];
      return {
        id: c.id,
        variantId: c.variantId,
        quantity: c.quantity,
        sortOrder: c.sortOrder,
        productId: c.variant.productId,
        productName: productT?.name ?? c.variant.product.name,
        productSlug: c.variant.product.slug,
        variantName: c.variant.name,
        variantSku: c.variant.sku,
        unitPrice: unit,
        linePrice: unit * c.quantity,
        currency,
        stock: c.variant.stock,
        imageUrl: images[0]?.url ?? null,
      };
    });
}

function packCompareTotal(
  components: PackComponentWithVariant[] | undefined,
  currency: SharedCurrency,
): number | null {
  if (!components?.length) return null;
  return components.reduce((sum, c) => {
    const unit = pickPrice(c.variant.prices, currency).amount;
    return sum + unit * c.quantity;
  }, 0);
}

function mapProductTranslations(
  translations: ProductTranslation[] | undefined,
): ProductTranslationDto[] {
  return (translations ?? []).map((t) => ({
    locale: t.locale as Locale,
    name: t.name,
    shortDescription: t.shortDescription,
    description: t.description,
    benefits: t.benefits,
    howToUse: t.howToUse,
    suitableFor: t.suitableFor,
  }));
}

function campaignTag(p: ProductWithRelations): string | null {
  const active = (p.promotionProducts ?? []).find((link) =>
    isPromotionWindowActive(link.promotion),
  );
  return active?.promotion.tag ?? null;
}

export function buildProductLabels(opts: {
  isIncoming?: boolean;
  inStock: boolean;
  compareAtFrom?: number | null;
  priceFrom: number;
  campaignTag?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
}): ProductLabelDto[] {
  const labels: ProductLabelDto[] = [];
  if (opts.isIncoming) labels.push({ kind: 'incoming' });
  const onSale =
    opts.compareAtFrom != null && opts.compareAtFrom > opts.priceFrom;
  if (opts.campaignTag || onSale) {
    labels.push({ kind: 'promotion', tag: opts.campaignTag ?? null });
  }
  if (opts.averageRating != null && opts.averageRating >= 4 && (opts.reviewCount ?? 0) >= 1) {
    labels.push({ kind: 'top_rated' });
  }
  if (!opts.inStock) labels.push({ kind: 'out_of_stock' });
  return labels;
}

export function mapProductListItem(
  p: ProductWithRelations,
  currency: SharedCurrency = SharedCurrency.USD,
  locale: SharedLocale = SharedLocale.EN,
  rating?: { averageRating: number; reviewCount: number } | null,
): ProductListItem {
  const t = pickTranslation(p.translations, locale);
  const kind = ((p as { kind?: string }).kind ?? 'PRODUCT') as SharedProductKind;
  const packQty = kind === SharedProductKind.PACK ? packAvailableQty(p.packComponents) : null;
  const activeVariants = p.variants.filter((v) => {
    if (!v.isActive) return false;
    if (packQty != null) return packQty > 0;
    return v.stock > 0;
  });
  const pool = activeVariants.length
    ? activeVariants
    : p.variants.filter((v) => v.isActive);
  const amounts = pool.map((v) => pickPrice(v.prices, currency).amount);
  const priceFrom = amounts.length ? Math.min(...amounts) : 0;
  const compareCandidates = pool
    .map((v) => pickPrice(v.prices, currency))
    .filter((row) => row.compareAtAmount != null && row.compareAtAmount > row.amount)
    .map((row) => row.compareAtAmount as number);
  const images = mapImages(p.images);
  let compareAtFrom = compareCandidates.length ? Math.min(...compareCandidates) : null;
  const packCompareAtFrom =
    kind === SharedProductKind.PACK ? packCompareTotal(p.packComponents, currency) : null;
  if (
    packCompareAtFrom != null &&
    packCompareAtFrom > priceFrom &&
    (compareAtFrom == null || packCompareAtFrom > compareAtFrom)
  ) {
    compareAtFrom = packCompareAtFrom;
  }
  const tag = campaignTag(p);
  const averageRating = rating?.averageRating ?? null;
  const reviewCount = rating?.reviewCount ?? 0;
  const inStock = packQty != null ? packQty > 0 : activeVariants.length > 0;
  const labels = buildProductLabels({
    isIncoming: p.isIncoming,
    inStock,
    compareAtFrom,
    priceFrom,
    campaignTag: tag,
    averageRating,
    reviewCount,
  });
  const isPromotion = labels.some((l) => l.kind === 'promotion');
  const isTopRated = labels.some((l) => l.kind === 'top_rated');

  return {
    id: p.id,
    name: t?.name ?? p.name,
    slug: p.slug,
    status: p.status as SharedProductStatus,
    kind,
    marketCode: p.market?.code
      ? (p.market.code as SharedMarketCode)
      : undefined,
    shortDescription: t?.shortDescription ?? p.shortDescription,
    category: mapCategory(p.category, locale),
    brand: mapBrand(p.brand, locale),
    priceFrom,
    compareAtFrom,
    packCompareAtFrom,
    currency,
    locale,
    imageUrl: images[0]?.url ?? null,
    inStock,
    isIncoming: p.isIncoming,
    isPromotion,
    isTopRated,
    tags: p.tags ?? [],
    defaultVariantId: activeVariants[0]?.id ?? pool[0]?.id ?? null,
    labels,
    averageRating: averageRating != null && reviewCount > 0 ? averageRating : null,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    packItemCount: kind === SharedProductKind.PACK ? (p.packComponents?.length ?? 0) : undefined,
  };
}

export function mapProductDetail(
  p: ProductWithRelations,
  currency: SharedCurrency = SharedCurrency.USD,
  locale: SharedLocale = SharedLocale.EN,
  includeAllTranslations = false,
  rating?: { averageRating: number; reviewCount: number } | null,
): ProductDetail {
  const t = pickTranslation(p.translations, locale);
  const listLike = mapProductListItem(p, currency, locale, rating);
  const kind = listLike.kind ?? SharedProductKind.PRODUCT;
  const packQty = kind === SharedProductKind.PACK ? packAvailableQty(p.packComponents) : null;
  const packComponents = mapPackComponents(p.packComponents, currency, locale);
  const packCompareAtFrom = listLike.packCompareAtFrom ?? null;
  const packSavings =
    packCompareAtFrom != null && packCompareAtFrom > listLike.priceFrom
      ? packCompareAtFrom - listLike.priceFrom
      : null;

  const variants = p.variants.map((v) => {
    const mapped = mapVariant(v, currency);
    if (packQty != null) {
      return { ...mapped, stock: packQty };
    }
    return mapped;
  });

  return {
    id: p.id,
    name: t?.name ?? p.name,
    slug: p.slug,
    status: p.status as SharedProductStatus,
    kind,
    marketCode: listLike.marketCode,
    shortDescription: t?.shortDescription ?? p.shortDescription,
    description: t?.description ?? p.description,
    benefits: t?.benefits ?? p.benefits,
    howToUse: t?.howToUse ?? p.howToUse,
    suitableFor: t?.suitableFor ?? p.suitableFor,
    category: mapCategory(p.category, locale, includeAllTranslations),
    brand: mapBrand(p.brand, locale, includeAllTranslations),
    currency,
    locale,
    translations: includeAllTranslations ? mapProductTranslations(p.translations) : undefined,
    variants,
    images: mapImages(p.images),
    isIncoming: p.isIncoming,
    incomingAt: p.incomingAt?.toISOString() ?? null,
    popularityScore: p.popularityScore,
    isPromotion: listLike.isPromotion,
    isTopRated: listLike.isTopRated,
    tags: p.tags ?? [],
    labels: listLike.labels,
    defaultVariantId: listLike.defaultVariantId,
    averageRating: listLike.averageRating,
    reviewCount: listLike.reviewCount,
    packComponents: kind === SharedProductKind.PACK ? packComponents : undefined,
    packCompareAtFrom: kind === SharedProductKind.PACK ? packCompareAtFrom : undefined,
    packSavings: kind === SharedProductKind.PACK ? packSavings : undefined,
  };
}

export function normalizeVariantPrices(input: {
  price?: number;
  compareAtPrice?: number | null;
  prices?: { currency: string; amount: number; compareAtAmount?: number | null }[];
}) {
  if (input.prices?.length) {
    return input.prices.map((p) => ({
      currency: p.currency as 'USD' | 'TND' | 'AED',
      amount: p.amount,
      compareAtAmount: p.compareAtAmount ?? null,
    }));
  }

  const usd = input.price ?? 0;
  const compare = input.compareAtPrice ?? null;
  return [
    { currency: 'USD' as const, amount: usd, compareAtAmount: compare },
    {
      currency: 'TND' as const,
      amount: Math.round(usd * 3.1),
      compareAtAmount: compare != null ? Math.round(compare * 3.1) : null,
    },
    {
      currency: 'AED' as const,
      amount: Math.round(usd * 3.67),
      compareAtAmount: compare != null ? Math.round(compare * 3.67) : null,
    },
  ];
}

export function resolveCategoryCopy(input: {
  name?: string;
  description?: string | null;
  translations?: { locale: string; name: string; description?: string | null }[];
}) {
  const translations =
    input.translations?.length
      ? input.translations
      : [
          {
            locale: 'en',
            name: input.name ?? '',
            description: input.description ?? null,
          },
        ];
  const en = translations.find((t) => t.locale === 'en') ?? translations[0]!;
  return {
    name: en.name,
    description: en.description ?? null,
    translations,
  };
}

export function resolveBrandCopy(input: {
  name?: string;
  description?: string | null;
  translations?: { locale: string; name: string; description?: string | null }[];
}) {
  return resolveCategoryCopy(input);
}

export function resolveProductCopy(input: {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  benefits?: string | null;
  howToUse?: string | null;
  suitableFor?: string | null;
  translations?: {
    locale: string;
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    benefits?: string | null;
    howToUse?: string | null;
    suitableFor?: string | null;
  }[];
}) {
  const translations =
    input.translations?.length
      ? input.translations
      : [
          {
            locale: 'en',
            name: input.name ?? '',
            shortDescription: input.shortDescription ?? null,
            description: input.description ?? null,
            benefits: input.benefits ?? null,
            howToUse: input.howToUse ?? null,
            suitableFor: input.suitableFor ?? null,
          },
        ];
  const en = translations.find((t) => t.locale === 'en') ?? translations[0]!;
  return {
    name: en.name,
    shortDescription: en.shortDescription ?? null,
    description: en.description ?? null,
    benefits: en.benefits ?? null,
    howToUse: en.howToUse ?? null,
    suitableFor: en.suitableFor ?? null,
    translations,
  };
}
