import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BehaviorEventType, Locale, Prisma } from '@prisma/client';
import type {
  AdminBehaviorRecentEventDto,
  AdminBehaviorStatsResponse,
  AdminBehaviorTopProductDto,
  AdminBehaviorTopSearchDto,
  BehaviorBatchResponse,
  BehaviorEventType as SharedBehaviorEventType,
  MarketCode,
} from '@lumea/types';
import { behaviorBatchSchema, behaviorStatsQuerySchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { marketCodeFromCurrencyValue, parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehaviorService {
  private readonly logger = new Logger(BehaviorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  ingestBatch(body: unknown): BehaviorBatchResponse {
    const parsed = behaviorBatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const events = parsed.data.events;
    const batchCurrency = parsed.data.currency ?? null;
    // Acknowledge immediately; process popularity / search insights asynchronously.
    setImmediate(() => {
      void this.processEvents(events, batchCurrency).catch((err) => {
        this.logger.warn(`Behavior batch processing failed: ${String(err)}`);
      });
    });

    return { accepted: events.length };
  }

  async getAdminStats(
    query: unknown,
    marketCode?: MarketCode | string | null,
  ): Promise<AdminBehaviorStatsResponse> {
    const parsed = behaviorStatsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { days, topLimit, recentLimit } = parsed.data;
    const code = marketCode ? parseMarketCode(marketCode) : null;
    const marketId = code ? (await this.marketsService.getByCode(code)).id : undefined;

    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    from.setUTCHours(0, 0, 0, 0);

    const baseWhere: Prisma.BehaviorEventWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(marketId ? { marketId } : {}),
    };

    const [typeGroups, sessionRows, clickGroups, searchGroups, recentRows] =
      await Promise.all([
        this.prisma.behaviorEvent.groupBy({
          by: ['type'],
          where: baseWhere,
          _count: { _all: true },
        }),
        this.prisma.behaviorEvent.findMany({
          where: { ...baseWhere, sessionId: { not: null } },
          select: { sessionId: true },
          distinct: ['sessionId'],
        }),
        this.prisma.behaviorEvent.groupBy({
          by: ['productId'],
          where: {
            ...baseWhere,
            type: BehaviorEventType.PRODUCT_CLICK,
            productId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { productId: 'desc' } },
          take: topLimit,
        }),
        this.prisma.behaviorEvent.groupBy({
          by: ['query'],
          where: {
            ...baseWhere,
            type: BehaviorEventType.SEARCH,
            query: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { query: 'desc' } },
          take: topLimit,
        }),
        this.prisma.behaviorEvent.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: recentLimit,
          select: {
            id: true,
            type: true,
            productId: true,
            query: true,
            path: true,
            sessionId: true,
            userId: true,
            createdAt: true,
          },
        }),
      ]);

    const countByType = new Map(
      typeGroups.map((g) => [g.type, g._count._all] as const),
    );

    const productIds = clickGroups
      .map((g) => g.productId)
      .filter((id): id is string => Boolean(id));

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: {
            id: { in: productIds },
            ...(marketId ? { marketId } : {}),
          },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    const topProducts: AdminBehaviorTopProductDto[] = clickGroups
      .filter((g): g is typeof g & { productId: string } => Boolean(g.productId))
      .map((g) => {
        const product = productById.get(g.productId);
        return {
          productId: g.productId,
          productName: product?.name ?? 'Unknown product',
          productSlug: product?.slug ?? '',
          clickCount: g._count._all,
        };
      })
      // Prefer rows that resolve to the working market when market filter is on.
      .filter((row) => (marketId ? Boolean(productById.has(row.productId)) : true));

    const topSearches: AdminBehaviorTopSearchDto[] = searchGroups
      .filter((g): g is typeof g & { query: string } => Boolean(g.query))
      .map((g) => ({
        query: g.query,
        count: g._count._all,
      }));

    const recentEvents: AdminBehaviorRecentEventDto[] = recentRows.map((row) => ({
      id: row.id,
      type: row.type as SharedBehaviorEventType,
      productId: row.productId,
      query: row.query,
      path: row.path,
      sessionId: row.sessionId,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      marketCode: code,
      totals: {
        searches: countByType.get(BehaviorEventType.SEARCH) ?? 0,
        productClicks: countByType.get(BehaviorEventType.PRODUCT_CLICK) ?? 0,
        pageViews: countByType.get(BehaviorEventType.PAGE_VIEW) ?? 0,
        uniqueSessions: sessionRows.length,
      },
      topProducts,
      topSearches,
      recentEvents,
    };
  }

  private async processEvents(
    events: {
      type: 'SEARCH' | 'PRODUCT_CLICK' | 'PAGE_VIEW';
      productId?: string | null;
      query?: string | null;
      locale?: string | null;
      currency?: string | null;
      path?: string | null;
      sessionId?: string | null;
      userId?: string | null;
    }[],
    batchCurrency: string | null,
  ) {
    const clickCounts = new Map<string, number>();
    const searchCounts = new Map<
      string,
      { query: string; locale: Locale; marketId: string; count: number }
    >();

    const rawRows: {
      type: BehaviorEventType;
      productId: string | null;
      query: string | null;
      locale: Locale | null;
      path: string | null;
      sessionId: string | null;
      userId: string | null;
      marketId: string | null;
    }[] = [];

    const marketIdByCode = new Map<string, string>();
    const resolveMarketId = async (currency?: string | null) => {
      const code = marketCodeFromCurrencyValue(currency ?? batchCurrency);
      const cached = marketIdByCode.get(code);
      if (cached) return cached;
      const market = await this.marketsService.getByCode(code);
      marketIdByCode.set(code, market.id);
      return market.id;
    };

    for (const event of events) {
      const locale = (event.locale as Locale | null | undefined) ?? null;
      const type =
        event.type === 'SEARCH'
          ? BehaviorEventType.SEARCH
          : event.type === 'PAGE_VIEW'
            ? BehaviorEventType.PAGE_VIEW
            : BehaviorEventType.PRODUCT_CLICK;

      const marketId = await resolveMarketId(event.currency);

      rawRows.push({
        type,
        productId: event.productId ?? null,
        query: event.query?.trim().slice(0, 200) || null,
        locale,
        path: event.path?.slice(0, 500) || null,
        sessionId: event.sessionId?.slice(0, 80) || null,
        userId: event.userId?.trim().slice(0, 64) || null,
        marketId,
      });

      if (type === BehaviorEventType.PRODUCT_CLICK && event.productId) {
        clickCounts.set(event.productId, (clickCounts.get(event.productId) ?? 0) + 1);
      }

      if (type === BehaviorEventType.SEARCH) {
        const q = event.query?.trim().toLowerCase().slice(0, 200);
        if (q) {
          const resolvedLocale = locale ?? Locale.en;
          const key = `${marketId}|${resolvedLocale}|${q}`;
          const existing = searchCounts.get(key);
          if (existing) existing.count += 1;
          else {
            searchCounts.set(key, {
              query: q,
              locale: resolvedLocale,
              marketId,
              count: 1,
            });
          }
        }
      }
    }

    if (rawRows.length) {
      await this.prisma.behaviorEvent.createMany({ data: rawRows });
    }

    for (const [productId, delta] of clickCounts) {
      await this.prisma.product
        .update({
          where: { id: productId },
          data: { popularityScore: { increment: delta } },
        })
        .catch(() => {
          // Product may have been deleted; skip.
        });
    }

    for (const { query, locale, marketId, count } of searchCounts.values()) {
      await this.prisma.searchInsight.upsert({
        where: {
          marketId_query_locale: { marketId, query, locale },
        },
        create: {
          query,
          locale,
          marketId,
          hitCount: count,
          lastSeenAt: new Date(),
        },
        update: {
          hitCount: { increment: count },
          lastSeenAt: new Date(),
        },
      });
    }
  }
}
