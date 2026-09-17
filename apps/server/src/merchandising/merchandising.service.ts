import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MerchandisingRailKind,
  Prisma,
  ProductKind,
  ProductStatus,
} from '@prisma/client';
import {
  Currency as SharedCurrency,
  Locale as SharedLocale,
  MarketCode,
  MerchandisingRailKind as SharedRailKind,
  type HomeProductRails,
  type MerchandisingRailItemDto,
  type MerchandisingRailsAdminDto,
  type ProductListItem,
  type SearchInsightDto,
} from '@lumea/types';
import {
  homeRailsQuerySchema,
  merchandisingRailKindSchema,
  merchandisingRailReplaceSchema,
} from '@lumea/validation';
import {
  CACHE_PREFIX,
  CatalogCacheService,
} from '../common/cache/catalog-cache.service';
import { MarketsService } from '../markets/markets.service';
import {
  currencyForMarket,
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { mapProductListItem } from '../products/product.mapper';

const productInclude = {
  category: { include: { translations: true } },
  brand: { include: { translations: true } },
  market: true,
  variants: { include: { prices: true } },
  images: { include: { media: true } },
  translations: true,
  promotionProducts: { include: { promotion: true } },
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

@Injectable()
export class MerchandisingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: ReviewsService,
    private readonly catalogCache: CatalogCacheService,
    private readonly marketsService: MarketsService,
  ) {}

  async listHomeRails(query: unknown): Promise<HomeProductRails> {
    const parsed = homeRailsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const marketCode = marketCodeFromCurrencyValue(parsed.data.currency);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.rails,
      JSON.stringify(parsed.data),
    );
    return this.catalogCache.getOrSet(cacheKey, async () => {
      const { currency, locale, limit } = parsed.data;
      const market = currency as SharedCurrency;
      const lang = locale as SharedLocale;
      const marketRow = await this.marketsService.getByCode(marketCode);

      const [top, neu, incoming, topPacks] = await Promise.all([
        this.resolveRail(MerchandisingRailKind.TOP, market, lang, limit, marketRow.id),
        this.resolveRail(MerchandisingRailKind.NEW, market, lang, limit, marketRow.id),
        this.resolveRail(MerchandisingRailKind.INCOMING, market, lang, limit, marketRow.id),
        this.resolveRail(MerchandisingRailKind.TOP_PACKS, market, lang, limit, marketRow.id),
      ]);

      return {
        top,
        new: neu,
        incoming,
        topPacks,
        currency: market,
        locale: lang,
      };
    });
  }

  async listAdminRails(
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<MerchandisingRailsAdminDto> {
    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);
    const currency = currencyForMarket(code) as SharedCurrency;
    const lang = SharedLocale.EN;
    const [top, neu, incoming, topPacks] = await Promise.all([
      this.listCurated(MerchandisingRailKind.TOP, currency, lang, marketRow.id),
      this.listCurated(MerchandisingRailKind.NEW, currency, lang, marketRow.id),
      this.listCurated(MerchandisingRailKind.INCOMING, currency, lang, marketRow.id),
      this.listCurated(MerchandisingRailKind.TOP_PACKS, currency, lang, marketRow.id),
    ]);
    return { top, new: neu, incoming, topPacks };
  }

  async replaceRail(
    railParam: string,
    body: unknown,
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<MerchandisingRailItemDto[]> {
    const railParsed = merchandisingRailKindSchema.safeParse(railParam);
    if (!railParsed.success) throw new BadRequestException('Invalid rail');
    const parsed = merchandisingRailReplaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);
    const rail = railParsed.data as MerchandisingRailKind;
    const productIds = parsed.data.productIds;

    if (productIds.length) {
      const found = await this.prisma.product.findMany({
        where: { id: { in: productIds }, marketId: marketRow.id },
        select: { id: true },
      });
      if (found.length !== productIds.length) {
        throw new NotFoundException('One or more products not found in this market');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.merchandisingRailItem.deleteMany({
        where: { rail, marketId: marketRow.id },
      });
      if (productIds.length) {
        await tx.merchandisingRailItem.createMany({
          data: productIds.map((productId, index) => ({
            rail,
            productId,
            marketId: marketRow.id,
            sortOrder: index,
          })),
        });
      }
    });

    await this.catalogCache.invalidateCatalog(code);
    const currency = currencyForMarket(code) as SharedCurrency;
    return this.listCurated(rail, currency, SharedLocale.EN, marketRow.id);
  }

  async listSearchInsights(
    limit = 50,
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<SearchInsightDto[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);
    const rows = await this.prisma.searchInsight.findMany({
      where: { marketId: marketRow.id },
      include: { market: true },
      orderBy: [{ hitCount: 'desc' }, { lastSeenAt: 'desc' }],
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      locale: (row.locale as SharedLocale | null) ?? null,
      hitCount: row.hitCount,
      lastSeenAt: row.lastSeenAt.toISOString(),
      marketCode: parseMarketCode(row.market.code),
    }));
  }

  private async resolveRail(
    rail: MerchandisingRailKind,
    currency: SharedCurrency,
    locale: SharedLocale,
    limit: number,
    marketId: string,
  ): Promise<ProductListItem[]> {
    const curated = await this.listCurated(rail, currency, locale, marketId);
    if (curated.length) {
      return curated.slice(0, limit).map((row) => row.product);
    }
    return this.autoRank(rail, currency, locale, limit, marketId);
  }

  private async listCurated(
    rail: MerchandisingRailKind,
    currency: SharedCurrency,
    locale: SharedLocale,
    marketId: string,
  ): Promise<MerchandisingRailItemDto[]> {
    const rows = await this.prisma.merchandisingRailItem.findMany({
      where: { rail, marketId },
      orderBy: { sortOrder: 'asc' },
      include: { product: { include: productInclude } },
    });

    const items = rows.map((row) => mapProductListItem(row.product, currency, locale));
    await this.attachRatings(items);

    return rows.map((row, index) => ({
      id: row.id,
      rail: row.rail as SharedRailKind,
      productId: row.productId,
      sortOrder: row.sortOrder,
      product: items[index]!,
    }));
  }

  private async autoRank(
    rail: MerchandisingRailKind,
    currency: SharedCurrency,
    locale: SharedLocale,
    limit: number,
    marketId: string,
  ): Promise<ProductListItem[]> {
    let where: Prisma.ProductWhereInput;
    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    const marketFilter = { marketId };

    if (rail === MerchandisingRailKind.INCOMING) {
      where = {
        status: ProductStatus.ACTIVE,
        isIncoming: true,
        ...marketFilter,
      };
      orderBy = [{ incomingAt: 'asc' }, { createdAt: 'desc' }];
    } else if (rail === MerchandisingRailKind.TOP_PACKS) {
      where = {
        status: ProductStatus.ACTIVE,
        kind: ProductKind.PACK,
        variants: { some: { isActive: true } },
        ...marketFilter,
      };
      orderBy = [{ popularityScore: 'desc' }, { createdAt: 'desc' }];
    } else if (rail === MerchandisingRailKind.NEW) {
      where = {
        status: ProductStatus.ACTIVE,
        variants: { some: { isActive: true, stock: { gt: 0 } } },
        ...marketFilter,
      };
      orderBy = { createdAt: 'desc' };
    } else {
      where = {
        status: ProductStatus.ACTIVE,
        variants: { some: { isActive: true, stock: { gt: 0 } } },
        ...marketFilter,
      };
      orderBy = [{ popularityScore: 'desc' }, { createdAt: 'desc' }];
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      take: limit,
    });

    const items = rows.map((row) => mapProductListItem(row, currency, locale));
    await this.attachRatings(items);
    return items;
  }

  private async attachRatings(items: ProductListItem[]) {
    if (!items.length) return;
    const summaries = await this.reviewsService.ratingSummariesForProducts(
      items.map((i) => i.id),
    );
    for (const item of items) {
      const summary = summaries.get(item.id);
      if (summary && summary.reviewCount > 0) {
        item.averageRating = summary.averageRating;
        item.reviewCount = summary.reviewCount;
        item.isTopRated = summary.averageRating >= 4;
        if (
          item.isTopRated &&
          !(item.labels ?? []).some((l) => l.kind === 'top_rated')
        ) {
          item.labels = [...(item.labels ?? []), { kind: 'top_rated' }];
        }
      }
    }
  }
}
