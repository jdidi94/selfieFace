import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Promotion, PromotionProduct } from '@prisma/client';
import type { MarketCode, ProductListItem, PromotionDto } from '@lumea/types';
import { Currency as SharedCurrency, Locale as SharedLocale } from '@lumea/types';
import { promotionUpsertSchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import {
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';
import {
  activePromotionWhere,
  mapProductListItem,
} from '../products/product.mapper';
import {
  CACHE_PREFIX,
  CatalogCacheService,
} from '../common/cache/catalog-cache.service';
import { ReviewsService } from '../reviews/reviews.service';
import { Prisma, ProductStatus } from '@prisma/client';

type PromotionWithProducts = Promotion & {
  products: PromotionProduct[];
  market?: { code: string } | null;
};

const productInclude = {
  category: { include: { translations: true } },
  brand: { include: { translations: true } },
  variants: { include: { prices: true } },
  images: { include: { media: true } },
  translations: true,
  promotionProducts: { include: { promotion: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
    private readonly reviewsService: ReviewsService,
    private readonly marketsService: MarketsService,
  ) {}

  private mapPromotion(row: PromotionWithProducts): PromotionDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      tag: row.tag,
      description: row.description,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      isActive: row.isActive,
      marketCode: row.market?.code
        ? parseMarketCode(row.market.code)
        : undefined,
      productIds: row.products.map((p) => p.productId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listAdmin(marketCode: MarketCode | string = 'OTHER'): Promise<PromotionDto[]> {
    const market = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.promotion.findMany({
      where: { marketId: market.id },
      include: { products: true, market: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.mapPromotion(row));
  }

  async getAdmin(id: string): Promise<PromotionDto> {
    const row = await this.prisma.promotion.findUnique({
      where: { id },
      include: { products: true, market: true },
    });
    if (!row) throw new NotFoundException('Promotion not found');
    return this.mapPromotion(row);
  }

  private async uniqueSlug(
    marketId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const root = slugify(base) || 'campaign';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.promotion.findUnique({
        where: { marketId_slug: { marketId, slug: candidate } },
        select: { id: true },
      });
      if (!existing || (excludeId && existing.id === excludeId)) return candidate;
      candidate = `${root}-${n}`;
      n += 1;
    }
  }

  private async assertProductsInMarket(productIds: string[], marketId: string) {
    if (!productIds.length) return;
    const found = await this.prisma.product.findMany({
      where: { id: { in: productIds }, marketId },
      select: { id: true },
    });
    if (found.length !== productIds.length) {
      throw new BadRequestException('One or more products are not in this market');
    }
  }

  async create(
    input: unknown,
    marketCode: MarketCode | string = 'OTHER',
  ): Promise<PromotionDto> {
    const parsed = promotionUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = parsed.data;
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const slug = await this.uniqueSlug(market.id, data.slug ?? data.name);
    const productIds = [...new Set(data.productIds ?? [])];
    await this.assertProductsInMarket(productIds, market.id);

    try {
      const row = await this.prisma.promotion.create({
        data: {
          name: data.name,
          slug,
          tag: data.tag,
          description: data.description ?? null,
          startsAt: data.startsAt ?? null,
          endsAt: data.endsAt ?? null,
          isActive: data.isActive ?? true,
          marketId: market.id,
          products: {
            create: productIds.map((productId) => ({ productId })),
          },
        },
        include: { products: true, market: true },
      });
      await this.catalogCache.invalidateCatalog(code);
      return this.mapPromotion(row);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Promotion slug already exists');
      }
      throw err;
    }
  }

  async update(id: string, input: unknown): Promise<PromotionDto> {
    const existing = await this.prisma.promotion.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Promotion not found');
    const parsed = promotionUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = parsed.data;
    const productIds = [...new Set(data.productIds ?? [])];
    await this.assertProductsInMarket(productIds, existing.marketId);
    const slug = await this.uniqueSlug(existing.marketId, data.slug ?? existing.slug, id);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
        return tx.promotion.update({
          where: { id },
          data: {
            name: data.name,
            slug,
            tag: data.tag,
            description: data.description ?? null,
            startsAt: data.startsAt ?? null,
            endsAt: data.endsAt ?? null,
            isActive: data.isActive ?? existing.isActive,
            products: {
              create: productIds.map((productId) => ({ productId })),
            },
          },
          include: { products: true, market: true },
        });
      });
      await this.catalogCache.invalidateCatalog(parseMarketCode(existing.market.code));
      return this.mapPromotion(row);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Promotion slug already exists');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.promotion.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Promotion not found');
    await this.prisma.promotion.delete({ where: { id } });
    await this.catalogCache.invalidateCatalog(parseMarketCode(existing.market.code));
  }

  async listActiveProducts(
    currency = 'USD',
    locale = 'en',
    limit = 12,
  ): Promise<ProductListItem[]> {
    const marketCode = marketCodeFromCurrencyValue(currency);
    const market = currency as SharedCurrency;
    const lang = locale as SharedLocale;
    const take = Math.min(Math.max(limit || 12, 1), 48);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.productsList,
      `promo-rail:${market}:${lang}:${take}`,
    );

    return this.catalogCache.getOrSet(cacheKey, async () => {
      const marketRow = await this.marketsService.getByCode(marketCode);
      const rows = await this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          marketId: marketRow.id,
          promotionProducts: {
            some: {
              promotion: {
                ...activePromotionWhere(),
                marketId: marketRow.id,
              },
            },
          },
        },
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        take,
      });
      const ratings = await this.reviewsService.ratingSummariesForProducts(
        rows.map((r) => r.id),
      );
      return rows.map((row) =>
        mapProductListItem(row, market, lang, ratings.get(row.id) ?? null),
      );
    });
  }

  private isUniqueViolation(err: unknown) {
    return (
      typeof err === 'object' &&
      err != null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }
}
