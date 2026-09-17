import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BehaviorEventType, Locale } from '@prisma/client';
import type { BehaviorBatchResponse } from '@lumea/types';
import { behaviorBatchSchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { marketCodeFromCurrencyValue } from '../markets/market.util';
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

  private async processEvents(
    events: {
      type: 'SEARCH' | 'PRODUCT_CLICK';
      productId?: string | null;
      query?: string | null;
      locale?: string | null;
      currency?: string | null;
      path?: string | null;
      sessionId?: string | null;
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
        event.type === 'SEARCH' ? BehaviorEventType.SEARCH : BehaviorEventType.PRODUCT_CLICK;

      rawRows.push({
        type,
        productId: event.productId ?? null,
        query: event.query?.trim().slice(0, 200) || null,
        locale,
        path: event.path?.slice(0, 500) || null,
        sessionId: event.sessionId?.slice(0, 80) || null,
      });

      if (type === BehaviorEventType.PRODUCT_CLICK && event.productId) {
        clickCounts.set(event.productId, (clickCounts.get(event.productId) ?? 0) + 1);
      }

      if (type === BehaviorEventType.SEARCH) {
        const q = event.query?.trim().toLowerCase().slice(0, 200);
        if (q) {
          const resolvedLocale = locale ?? Locale.en;
          const marketId = await resolveMarketId(event.currency);
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
