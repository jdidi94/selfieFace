import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Locale, Prisma, ProductKind, ProductStatus } from '@prisma/client';
import {
  Currency as SharedCurrency,
  Locale as SharedLocale,
  MarketCode,
  type CatalogCopyResult,
  type ProductDetail,
  type ProductListItem,
  type ProductListResponse,
} from '@lumea/types';
import {
  productAdminListQuerySchema,
  productBulkTagsSchema,
  productCreateSchema,
  productListQuerySchema,
  productPriceRangeQuerySchema,
  productUpdateSchema,
} from '@lumea/validation';
import {
  amountForCurrency,
  resolveCopyTarget,
  skuForMarket,
} from '../catalog/catalog-copy.util';
import {
  CACHE_PREFIX,
  CatalogCacheService,
} from '../common/cache/catalog-cache.service';
import { MarketsService } from '../markets/markets.service';
import { marketCodeFromCurrencyValue, parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { slugify } from '../common/slug.util';
import { setVariantStockOnDefaultWarehouse } from '../inventory/warehouse-stock.util';
import {
  mapProductDetail,
  mapProductListItem,
  normalizeVariantPrices,
  resolveProductCopy,
  activePromotionWhere,
} from './product.mapper';

/** Complementary step tags used to build "Complete your ritual" rails. */
const RITUAL_PARTNERS: Record<string, string[]> = {
  cleanser: ['toner', 'serum', 'moisturizer', 'spf'],
  toner: ['serum', 'moisturizer', 'cleanser'],
  serum: ['moisturizer', 'spf', 'oil', 'toner'],
  moisturizer: ['spf', 'serum', 'oil', 'cleanser'],
  cream: ['serum', 'spf', 'cleanser'],
  spf: ['cleanser', 'moisturizer', 'serum'],
  oil: ['cleanser', 'serum', 'moisturizer'],
  hydrating: ['serum', 'moisturizer', 'toner', 'cream'],
  body: ['hydrating', 'oil'],
};

function ritualPartnerTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    const key = tag.trim().toLowerCase();
    for (const partner of RITUAL_PARTNERS[key] ?? []) out.add(partner);
  }
  return [...out];
}

const productInclude = {
  category: { include: { translations: true } },
  problemCategories: { include: { translations: true } },
  brand: { include: { translations: true } },
  market: true,
  variants: { include: { prices: true } },
  images: { include: { media: true } },
  translations: true,
  promotionProducts: {
    include: { promotion: true },
  },
  packComponents: {
    include: {
      variant: {
        include: {
          prices: true,
          product: {
            include: {
              translations: true,
              images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

function normalizeTags(tags?: string[] | null): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: ReviewsService,
    private readonly catalogCache: CatalogCacheService,
    private readonly marketsService: MarketsService,
  ) {}

  async listPublic(query: unknown): Promise<ProductListResponse> {
    const parsed = productListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const marketCode = marketCodeFromCurrencyValue(parsed.data.currency);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.productsList,
      JSON.stringify(parsed.data),
    );
    return this.catalogCache.getOrSet(cacheKey, () => this.listPublicUncached(parsed.data));
  }

  private async listPublicUncached(
    data: ReturnType<typeof productListQuerySchema.parse>,
  ): Promise<ProductListResponse> {
    const {
      q,
      category,
      problemCategory,
      brand,
      kind,
      currency,
      locale,
      minPrice,
      maxPrice,
      minRating,
      recommended,
      incoming,
      promotion,
      sort,
      order,
      page,
      pageSize,
    } = data;
    const market = (currency ?? 'USD') as SharedCurrency;
    const lang = (locale ?? 'en') as SharedLocale;
    const marketCode = marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);

    const stockFilter: Prisma.ProductWhereInput['variants'] = {
      some: { isActive: true },
    };

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      marketId: marketRow.id,
      variants: stockFilter,
      ...(kind ? { kind: kind as ProductKind } : {}),
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { shortDescription: { contains: q, mode: 'insensitive' } },
        {
          translations: {
            some: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { shortDescription: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (category) {
      const matchedCategory = await this.prisma.category.findUnique({
        where: { marketId_slug: { marketId: marketRow.id, slug: category } },
        select: { id: true, kind: true },
      });
      if (matchedCategory?.kind === 'PROBLEM') {
        where.problemCategories = { some: { id: matchedCategory.id } };
      } else {
        where.category = { slug: category, marketId: marketRow.id };
      }
    }
    if (problemCategory) {
      where.problemCategories = {
        some: { slug: problemCategory, marketId: marketRow.id },
      };
    }
    if (brand) where.brand = { slug: brand, marketId: marketRow.id };
    if (incoming) where.isIncoming = true;
    if (recommended) where.popularityScore = { gt: 0 };
    if (promotion) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { promotionProducts: { some: { promotion: { ...activePromotionWhere(), marketId: marketRow.id } } } },
            {
              variants: {
                some: {
                  isActive: true,
                  prices: {
                    some: {
                      currency: market as Currency,
                      compareAtAmount: { not: null },
                    },
                  },
                },
              },
            },
          ],
        },
      ];
    }
    if (minPrice != null || maxPrice != null) {
      where.variants = {
        some: {
          isActive: true,
          prices: {
            some: {
              currency: market as Currency,
              amount: {
                ...(minPrice != null ? { gte: minPrice } : {}),
                ...(maxPrice != null ? { lte: maxPrice } : {}),
              },
            },
          },
        },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = recommended
      ? { popularityScore: 'desc' }
      : sort === 'name'
        ? { name: order === 'desc' ? 'desc' : 'asc' }
        : { name: 'asc' };

    const needsPostFilter =
      minRating != null || Boolean(promotion) || sort === 'price';

    if (!needsPostFilter) {
      const [total, rows] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          include: productInclude,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      const ratings = await this.reviewsService.ratingSummariesForProducts(
        rows.map((row) => row.id),
      );

      return {
        items: rows.map((row) =>
          mapProductListItem(row, market, lang, ratings.get(row.id) ?? null),
        ),
        total,
        page,
        pageSize,
        currency: market,
        locale: lang,
      };
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
    });
    const ratings = await this.reviewsService.ratingSummariesForProducts(
      rows.map((row) => row.id),
    );

    let items = rows.map((row) =>
      mapProductListItem(row, market, lang, ratings.get(row.id) ?? null),
    );

    if (minRating != null) {
      items = items.filter(
        (item) =>
          item.averageRating != null && item.averageRating >= minRating,
      );
    }
    if (promotion) {
      items = items.filter((item) => item.isPromotion);
    }
    if (sort === 'price') {
      const dir = order === 'desc' ? -1 : 1;
      items.sort((a, b) => (a.priceFrom - b.priceFrom) * dir);
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      currency: market,
      locale: lang,
    };
  }

  async getBySlug(
    slug: string,
    currency = 'USD',
    locale = 'en',
  ): Promise<ProductDetail> {
    const marketCode = marketCodeFromCurrencyValue(currency);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.productDetail,
      `${slug}:${currency}:${locale}`,
    );
    return this.catalogCache.getOrSet(cacheKey, () =>
      this.getBySlugUncached(slug, currency, locale),
    );
  }

  private async getBySlugUncached(
    slug: string,
    currency = 'USD',
    locale = 'en',
  ): Promise<ProductDetail> {
    const market = currency as SharedCurrency;
    const lang = locale as SharedLocale;
    const marketRow = await this.marketsService.getByCode(marketCodeFromCurrencyValue(currency));
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, marketId: marketRow.id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    const summary = (await this.reviewsService.ratingSummariesForProducts([product.id])).get(
      product.id,
    );
    return mapProductDetail(
      product,
      market,
      lang,
      false,
      summary && summary.reviewCount > 0 ? summary : null,
    );
  }

  async listRelated(
    slug: string,
    currency = 'USD',
    locale = 'en',
    limit = 4,
  ): Promise<ProductListItem[]> {
    const marketCode = marketCodeFromCurrencyValue(currency);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.productRelated,
      `${slug}:${currency}:${locale}:${limit}`,
    );
    return this.catalogCache.getOrSet(cacheKey, () =>
      this.listRelatedUncached(slug, currency, locale, limit),
    );
  }

  private async listRelatedUncached(
    slug: string,
    currency = 'USD',
    locale = 'en',
    limit = 4,
  ): Promise<ProductListItem[]> {
    const market = currency as SharedCurrency;
    const lang = locale as SharedLocale;
    const take = Math.min(Math.max(limit || 4, 1), 12);
    const marketRow = await this.marketsService.getByCode(marketCodeFromCurrencyValue(currency));

    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, marketId: marketRow.id },
      select: { id: true, categoryId: true, brandId: true, tags: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const baseWhere: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      marketId: marketRow.id,
      id: { not: product.id },
      variants: { some: { isActive: true } },
    };

    const ritualPartners = ritualPartnerTags(product.tags);
    const seedTags = [...new Set([...product.tags, ...ritualPartners])];

    const candidates = await this.prisma.product.findMany({
      where: {
        ...baseWhere,
        OR: [
          { categoryId: product.categoryId },
          { brandId: product.brandId },
          ...(seedTags.length ? [{ tags: { hasSome: seedTags } }] : []),
        ],
      },
      include: productInclude,
      orderBy: [{ popularityScore: 'desc' }, { name: 'asc' }],
      take: Math.max(take * 6, 24),
    });

    const scored = candidates
      .map((row) => {
        let score = 0;
        if (row.categoryId === product.categoryId) score += 3;
        if (row.brandId === product.brandId) score += 2;
        const overlap = row.tags.filter((t) => product.tags.includes(t)).length;
        score += overlap * 4;
        const ritualHits = row.tags.filter((t) => ritualPartners.includes(t)).length;
        score += ritualHits * 5;
        score += Math.min(row.popularityScore, 50) / 25;
        return { row, score };
      })
      .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));

    let rows = scored.slice(0, take).map((s) => s.row);

    if (rows.length < take) {
      const excludeIds = [product.id, ...rows.map((r) => r.id)];
      const filler = await this.prisma.product.findMany({
        where: { ...baseWhere, id: { notIn: excludeIds } },
        include: productInclude,
        orderBy: [{ popularityScore: 'desc' }, { name: 'asc' }],
        take: take - rows.length,
      });
      rows = [...rows, ...filler];
    }

    const ratings = await this.reviewsService.ratingSummariesForProducts(
      rows.map((r) => r.id),
    );
    return rows.map((row) =>
      mapProductListItem(row, market, lang, ratings.get(row.id) ?? null),
    );
  }

  async getPublicPriceRange(query: unknown): Promise<{ min: number; max: number; currency: string }> {
    const parsed = productPriceRangeQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const market = parsed.data.currency as Currency;
    const marketRow = await this.marketsService.getByCode(marketCodeFromCurrencyValue(market));

    const agg = await this.prisma.variantPrice.aggregate({
      where: {
        currency: market,
        variant: {
          isActive: true,
          product: { status: ProductStatus.ACTIVE, marketId: marketRow.id },
        },
      },
      _min: { amount: true },
      _max: { amount: true },
    });

    return {
      min: agg._min.amount ?? 0,
      max: agg._max.amount ?? 0,
      currency: market,
    };
  }

  async listAdmin(query: unknown): Promise<ProductListResponse> {
    const parsed = productAdminListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { q, category, brand, status, kind, market: marketQuery, page, limit } = parsed.data;
    const market = SharedCurrency.USD;
    const lang = SharedLocale.EN;
    const pageSize = limit;
    const marketCode = parseMarketCode(marketQuery);
    const marketRow = await this.marketsService.getByCode(marketCode);

    const where: Prisma.ProductWhereInput = { marketId: marketRow.id };
    if (status) where.status = status as ProductStatus;
    if (kind) where.kind = kind as ProductKind;
    if (category) {
      where.category = {
        OR: [{ slug: category }, { id: category }],
      };
    }
    if (brand) {
      where.brand = {
        OR: [{ slug: brand }, { id: brand }],
      };
    }
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { id: term },
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        {
          translations: {
            some: { name: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          variants: {
            some: { sku: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => mapProductListItem(row, market, lang)),
      total,
      page,
      pageSize,
      currency: market,
      locale: lang,
    };
  }

  async getAdmin(
    id: string,
    currency = 'USD',
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<ProductDetail> {
    const market = currency as SharedCurrency;
    const marketRow = await this.marketsService.getByCode(marketCode);
    const product = await this.prisma.product.findFirst({
      where: { id, marketId: marketRow.id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return mapProductDetail(product, market, SharedLocale.EN, true);
  }

  async create(
    input: unknown,
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<ProductDetail> {
    const parsed = productCreateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const data = parsed.data;
    const copy = resolveProductCopy(data);
    const slug = data.slug ?? slugify(copy.name);

    const resolvedMarket = parseMarketCode(data.marketCode ?? marketCode);
    const marketRow = await this.marketsService.getByCode(resolvedMarket);
    await this.assertCatalogRefsInMarket(data.categoryId, data.brandId, marketRow.id);
    await this.assertProblemCategories(data.problemCategoryIds ?? [], data.categoryId, marketRow.id);
    const product = await this.prisma.product.create({
      data: {
        name: copy.name,
        slug,
        status: (data.status as ProductStatus) ?? ProductStatus.DRAFT,
        kind: (data.kind as ProductKind) ?? ProductKind.PRODUCT,
        shortDescription: copy.shortDescription,
        description: copy.description,
        benefits: copy.benefits,
        howToUse: copy.howToUse,
        suitableFor: copy.suitableFor,
        competitorPriceAmount: data.competitorPriceAmount ?? null,
        competitorPriceSource: data.competitorPriceSource ?? null,
        competitorPriceCheckedAt: data.competitorPriceCheckedAt ?? null,
        categoryId: data.categoryId,
        problemCategories: data.problemCategoryIds?.length
          ? { connect: data.problemCategoryIds.map((id) => ({ id })) }
          : undefined,
        brandId: data.brandId,
        marketId: marketRow.id,
        isIncoming: data.isIncoming ?? false,
        incomingAt: data.incomingAt ?? null,
        tags: normalizeTags(data.tags),
        translations: {
          create: copy.translations.map((t) => ({
            locale: t.locale as Locale,
            name: t.name,
            shortDescription: t.shortDescription ?? null,
            description: t.description ?? null,
            benefits: t.benefits ?? null,
            howToUse: t.howToUse ?? null,
            suitableFor: t.suitableFor ?? null,
          })),
        },
        variants: {
          create: data.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock ?? 0,
            weightGrams: v.weightGrams ?? null,
            barcode: v.barcode ?? null,
            isActive: v.isActive ?? true,
            prices: {
              create: normalizeVariantPrices(v).map((p) => ({
                currency: p.currency as Currency,
                amount: p.amount,
                compareAtAmount: p.compareAtAmount,
              })),
            },
          })),
        },
        images: data.imageMediaIds?.length
          ? {
              create: data.imageMediaIds.map((mediaId, index) => ({
                mediaId,
                sortOrder: index,
              })),
            }
          : undefined,
        packComponents:
          data.kind === 'PACK' && data.packComponents?.length
            ? {
                create: data.packComponents.map((c, index) => ({
                  variantId: c.variantId,
                  quantity: c.quantity,
                  sortOrder: c.sortOrder ?? index,
                })),
              }
            : undefined,
      },
      include: productInclude,
    });

    for (const v of product.variants) {
      try {
        await setVariantStockOnDefaultWarehouse(this.prisma, v.id, v.stock);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Failed to place stock on default warehouse',
        );
      }
    }

    await this.catalogCache.invalidateCatalog();
    await this.syncPackVariantStock(product.id);
    const refreshed = await this.prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude,
    });
    return mapProductDetail(refreshed, SharedCurrency.USD, SharedLocale.EN, true);
  }

  /** Mirror pack sellable qty onto the pack variant stock field for cart/admin displays. */
  private async syncPackVariantStock(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        packComponents: { include: { variant: { select: { stock: true } } } },
      },
    });
    if (!product || product.kind !== ProductKind.PACK || !product.variants[0]) return;
    const available = product.packComponents.length
      ? Math.min(
          ...product.packComponents.map((c) =>
            Math.floor(c.variant.stock / Math.max(1, c.quantity)),
          ),
        )
      : 0;
    const next = Math.max(0, available);
    await setVariantStockOnDefaultWarehouse(this.prisma, product.variants[0].id, next, {
      force: true,
    });
  }

  async update(id: string, input: unknown): Promise<ProductDetail> {
    const parsed = productUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    const data = parsed.data;
    const hasCopyFields =
      data.translations != null ||
      data.name != null ||
      data.shortDescription !== undefined ||
      data.description !== undefined ||
      data.benefits !== undefined ||
      data.howToUse !== undefined ||
      data.suitableFor !== undefined;

    await this.assertCatalogRefsInMarket(
      data.categoryId ?? existing.categoryId,
      data.brandId ?? existing.brandId,
      existing.marketId,
    );
    if (data.problemCategoryIds !== undefined) {
      await this.assertProblemCategories(
        data.problemCategoryIds,
        data.categoryId ?? existing.categoryId,
        existing.marketId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      let copy:
        | ReturnType<typeof resolveProductCopy>
        | undefined;

      if (hasCopyFields) {
        copy = resolveProductCopy({
          name: data.name ?? existing.name,
          shortDescription:
            data.shortDescription !== undefined
              ? data.shortDescription
              : existing.shortDescription,
          description:
            data.description !== undefined ? data.description : existing.description,
          benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
          howToUse: data.howToUse !== undefined ? data.howToUse : existing.howToUse,
          suitableFor:
            data.suitableFor !== undefined ? data.suitableFor : existing.suitableFor,
          translations: data.translations,
        });
      }

      await tx.product.update({
        where: { id },
        data: {
          ...(copy ? { name: copy.name } : {}),
          ...(data.slug != null ? { slug: data.slug } : {}),
          ...(data.status != null ? { status: data.status as ProductStatus } : {}),
          ...(copy
            ? {
                shortDescription: copy.shortDescription,
                description: copy.description,
                benefits: copy.benefits,
                howToUse: copy.howToUse,
                suitableFor: copy.suitableFor,
              }
            : {}),
          ...(data.competitorPriceAmount !== undefined
            ? { competitorPriceAmount: data.competitorPriceAmount }
            : {}),
          ...(data.competitorPriceSource !== undefined
            ? { competitorPriceSource: data.competitorPriceSource }
            : {}),
          ...(data.competitorPriceCheckedAt !== undefined
            ? { competitorPriceCheckedAt: data.competitorPriceCheckedAt }
            : {}),
          ...(data.categoryId != null ? { categoryId: data.categoryId } : {}),
          ...(data.problemCategoryIds !== undefined
            ? {
                problemCategories: {
                  set: data.problemCategoryIds.map((problemId) => ({ id: problemId })),
                },
              }
            : data.categoryId != null
              ? { problemCategories: { set: [] } }
              : {}),
          ...(data.brandId != null ? { brandId: data.brandId } : {}),
          ...(data.kind != null ? { kind: data.kind as ProductKind } : {}),
          ...(data.isIncoming != null ? { isIncoming: data.isIncoming } : {}),
          ...(data.incomingAt !== undefined ? { incomingAt: data.incomingAt } : {}),
          ...(data.tags !== undefined ? { tags: normalizeTags(data.tags) } : {}),
        },
      });

      if (data.packComponents !== undefined) {
        await tx.packComponent.deleteMany({ where: { packProductId: id } });
        if (data.packComponents.length) {
          await tx.packComponent.createMany({
            data: data.packComponents.map((c, index) => ({
              packProductId: id,
              variantId: c.variantId,
              quantity: c.quantity,
              sortOrder: c.sortOrder ?? index,
            })),
          });
        }
      }

      if (copy) {
        for (const t of copy.translations) {
          await tx.productTranslation.upsert({
            where: {
              productId_locale: {
                productId: id,
                locale: t.locale as Locale,
              },
            },
            create: {
              productId: id,
              locale: t.locale as Locale,
              name: t.name,
              shortDescription: t.shortDescription ?? null,
              description: t.description ?? null,
              benefits: t.benefits ?? null,
              howToUse: t.howToUse ?? null,
              suitableFor: t.suitableFor ?? null,
            },
            update: {
              name: t.name,
              shortDescription: t.shortDescription ?? null,
              description: t.description ?? null,
              benefits: t.benefits ?? null,
              howToUse: t.howToUse ?? null,
              suitableFor: t.suitableFor ?? null,
            },
          });
        }
      }

      if (data.variants) {
        for (const v of data.variants) {
          const priceRows = normalizeVariantPrices(v);
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: v.sku,
                stock: v.stock,
                weightGrams: v.weightGrams ?? null,
                barcode: v.barcode ?? null,
                isActive: v.isActive ?? true,
              },
            });
            if (v.stock != null) {
              await setVariantStockOnDefaultWarehouse(tx, v.id, v.stock);
            }
            for (const p of priceRows) {
              await tx.variantPrice.upsert({
                where: {
                  variantId_currency: {
                    variantId: v.id,
                    currency: p.currency as Currency,
                  },
                },
                create: {
                  variantId: v.id,
                  currency: p.currency as Currency,
                  amount: p.amount,
                  compareAtAmount: p.compareAtAmount,
                },
                update: {
                  amount: p.amount,
                  compareAtAmount: p.compareAtAmount,
                },
              });
            }
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                name: v.name,
                sku: v.sku,
                stock: v.stock ?? 0,
                weightGrams: v.weightGrams ?? null,
                barcode: v.barcode ?? null,
                isActive: v.isActive ?? true,
                prices: {
                  create: priceRows.map((p) => ({
                    currency: p.currency as Currency,
                    amount: p.amount,
                    compareAtAmount: p.compareAtAmount,
                  })),
                },
              },
            });
            await setVariantStockOnDefaultWarehouse(tx, created.id, v.stock ?? 0);
          }
        }
      }

      if (data.imageMediaIds) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (data.imageMediaIds.length) {
          await tx.productImage.createMany({
            data: data.imageMediaIds.map((mediaId, index) => ({
              productId: id,
              mediaId,
              sortOrder: index,
            })),
          });
        }
      }
    });

    await this.catalogCache.invalidateCatalog();
    await this.syncPackVariantStock(id);
    return this.getAdmin(id);
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    await this.catalogCache.invalidateCatalog();
    return { success: true };
  }

  async bulkTags(input: unknown): Promise<{ updated: number; items: { id: string; tags: string[] }[] }> {
    const parsed = productBulkTagsSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const add = normalizeTags(parsed.data.add);
    const remove = new Set(normalizeTags(parsed.data.remove));
    const products = await this.prisma.product.findMany({
      where: { id: { in: parsed.data.productIds } },
      select: { id: true, tags: true },
    });
    if (!products.length) {
      throw new NotFoundException('No matching products');
    }

    const items: { id: string; tags: string[] }[] = [];
    await this.prisma.$transaction(
      products.map((product) => {
        let tags = normalizeTags([...product.tags, ...add]);
        if (remove.size) tags = tags.filter((t) => !remove.has(t));
        items.push({ id: product.id, tags });
        return this.prisma.product.update({
          where: { id: product.id },
          data: { tags },
        });
      }),
    );

    await this.catalogCache.invalidateCatalog();
    return { updated: items.length, items };
  }

  async copyToMarket(id: string, input: unknown): Promise<CatalogCopyResult> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: {
        market: true,
        brand: { include: { translations: true } },
        category: { include: { translations: true } },
        translations: true,
        images: true,
        variants: { include: { prices: true } },
        packComponents: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, slug: true, name: true } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const { target, sourceCode, targetCode } = await resolveCopyTarget(
      this.marketsService,
      input,
      existing.market.code,
    );

    const clash = await this.prisma.product.findUnique({
      where: { marketId_slug: { marketId: target.id, slug: existing.slug } },
    });
    if (clash) {
      throw new BadRequestException(
        `Product slug "${existing.slug}" already exists in ${targetCode}`,
      );
    }

    const warnings: string[] = [];

    const brandId = await this.ensureBrandInMarket(
      existing.brand,
      target.id,
      targetCode,
      warnings,
    );
    const categoryId = await this.ensureCategoryInMarket(
      existing.category,
      target.id,
      targetCode,
      warnings,
    );

    let created;
    try {
      created = await this.prisma.product.create({
        data: {
          name: existing.name,
          slug: existing.slug,
          status: existing.status,
          kind: existing.kind,
          shortDescription: existing.shortDescription,
          description: existing.description,
          benefits: existing.benefits,
          howToUse: existing.howToUse,
          suitableFor: existing.suitableFor,
          categoryId,
          brandId,
          marketId: target.id,
          popularityScore: existing.popularityScore,
          isIncoming: existing.isIncoming,
          incomingAt: existing.incomingAt,
          tags: existing.tags,
          translations: {
            create: existing.translations.map((t) => ({
              locale: t.locale,
              name: t.name,
              shortDescription: t.shortDescription,
              description: t.description,
              benefits: t.benefits,
              howToUse: t.howToUse,
              suitableFor: t.suitableFor,
            })),
          },
          images: {
            create: existing.images.map((img) => ({
              mediaId: img.mediaId,
              sortOrder: img.sortOrder,
              alt: img.alt,
            })),
          },
          variants: {
            create: existing.variants.map((v) => {
              const money = amountForCurrency(v.prices, target.currency);
              return {
                name: v.name,
                sku: skuForMarket(v.sku, target.code),
                stock: v.stock,
                weightGrams: v.weightGrams,
                barcode: v.barcode,
                isActive: v.isActive,
                prices: {
                  create: [
                    {
                      currency: target.currency,
                      amount: money.amount,
                      compareAtAmount: money.compareAtAmount,
                    },
                  ],
                },
              };
            }),
          },
        },
        include: { variants: true },
      });
    } catch (err) {
      if (
        typeof err === 'object' &&
        err != null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          `Could not copy product: slug or SKU already exists in ${targetCode}`,
        );
      }
      throw err;
    }

    for (const sv of existing.variants) {
      const tv = created.variants.find((v) => v.name === sv.name);
      if (!tv) continue;
      try {
        await setVariantStockOnDefaultWarehouse(this.prisma, tv.id, sv.stock);
      } catch (err) {
        warnings.push(
          `Stock not set for SKU ${tv.sku}: ${
            err instanceof Error ? err.message : 'no default warehouse'
          }`,
        );
      }
    }

    if (existing.kind === ProductKind.PACK && existing.packComponents.length) {
      let linked = 0;
      for (const comp of existing.packComponents) {
        const mapped = await this.findPackComponentVariantInMarket(
          comp.variant,
          target.id,
          target.code,
        );
        if (!mapped) {
          warnings.push(
            `Pack component "${comp.variant.product.name}" / ${comp.variant.name} not found in ${targetCode} — skipped. Copy that product first, then re-edit this pack.`,
          );
          continue;
        }
        await this.prisma.packComponent.create({
          data: {
            packProductId: created.id,
            variantId: mapped,
            quantity: comp.quantity,
            sortOrder: comp.sortOrder,
          },
        });
        linked += 1;
      }
      if (linked === 0 && existing.packComponents.length > 0) {
        warnings.push(
          'Pack was copied without any components. Copy component products into the target market, then edit the pack.',
        );
      }
      await this.syncPackVariantStock(created.id);
    }

    await this.catalogCache.invalidateCatalog(targetCode);
    return {
      id: created.id,
      type: 'product',
      sourceMarket: sourceCode,
      targetMarket: targetCode,
      warnings,
    };
  }

  private async ensureBrandInMarket(
    brand: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      imageUrl: string | null;
      translations: { locale: Locale; name: string; description: string | null }[];
    },
    targetMarketId: string,
    targetCode: MarketCode,
    warnings: string[],
  ): Promise<string> {
    const existing = await this.prisma.brand.findUnique({
      where: { marketId_slug: { marketId: targetMarketId, slug: brand.slug } },
    });
    if (existing) return existing.id;

    const created = await this.prisma.brand.create({
      data: {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        imageUrl: brand.imageUrl,
        marketId: targetMarketId,
        translations: {
          create: brand.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description,
          })),
        },
      },
    });
    warnings.push(`Created brand "${brand.name}" in ${targetCode}`);
    return created.id;
  }

  private async ensureCategoryInMarket(
    category: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      sortOrder: number;
      translations: { locale: Locale; name: string; description: string | null }[];
    },
    targetMarketId: string,
    targetCode: MarketCode,
    warnings: string[],
  ): Promise<string> {
    const existing = await this.prisma.category.findUnique({
      where: { marketId_slug: { marketId: targetMarketId, slug: category.slug } },
    });
    if (existing) return existing.id;

    const created = await this.prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        marketId: targetMarketId,
        translations: {
          create: category.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description,
          })),
        },
      },
    });
    warnings.push(`Created category "${category.name}" in ${targetCode}`);
    return created.id;
  }

  /**
   * Resolve a pack component variant in the target market by product slug +
   * variant name, then by market-suffixed SKU.
   */
  private async findPackComponentVariantInMarket(
    sourceVariant: {
      id: string;
      name: string;
      sku: string;
      product: { id: string; slug: string; name: string };
    },
    targetMarketId: string,
    targetCode: string,
  ): Promise<string | null> {
    const bySlug = await this.prisma.productVariant.findFirst({
      where: {
        name: sourceVariant.name,
        product: {
          marketId: targetMarketId,
          slug: sourceVariant.product.slug,
        },
      },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;

    const targetSku = skuForMarket(sourceVariant.sku, targetCode);
    const bySku = await this.prisma.productVariant.findUnique({
      where: { sku: targetSku },
      select: { id: true, product: { select: { marketId: true } } },
    });
    if (bySku && bySku.product.marketId === targetMarketId) return bySku.id;
    return null;
  }

  private async assertCatalogRefsInMarket(
    categoryId: string,
    brandId: string,
    marketId: string,
  ) {
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoryId }, select: { marketId: true, kind: true } }),
      this.prisma.brand.findUnique({ where: { id: brandId }, select: { marketId: true } }),
    ]);
    if (!category) throw new BadRequestException('Category not found');
    if (!brand) throw new BadRequestException('Brand not found');
    if (category.marketId !== marketId) {
      throw new BadRequestException('Category is not in this market');
    }
    if (category.kind !== 'CATEGORY') {
      throw new BadRequestException('Choose a main category, not a problem subcategory');
    }
    if (brand.marketId !== marketId) {
      throw new BadRequestException('Brand is not in this market');
    }
  }

  private async assertProblemCategories(
    ids: string[],
    parentCategoryId: string,
    marketId: string,
  ) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException('Problem subcategories must be unique');
    }
    if (!uniqueIds.length) return;
    const rows = await this.prisma.category.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, marketId: true, kind: true, parentCategoryId: true },
    });
    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('One or more problem subcategories do not exist');
    }
    if (
      rows.some(
        (row) =>
          row.marketId !== marketId ||
          row.kind !== 'PROBLEM' ||
          row.parentCategoryId !== parentCategoryId,
      )
    ) {
      throw new BadRequestException(
        'Problem subcategories must belong to the selected main category and market',
      );
    }
  }
}
