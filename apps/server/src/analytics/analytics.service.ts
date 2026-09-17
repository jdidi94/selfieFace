import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Currency as PrismaCurrency,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type {
  AdminAnalyticsResponse,
  AdminDashboardResponse,
  AnalyticsDailyPoint,
  AnalyticsLowStockItem,
  AnalyticsOrdersByStatus,
  AnalyticsRevenueByCurrency,
  AnalyticsTopProduct,
  Currency,
  MarketCode,
} from '@lumea/types';
import { analyticsQuerySchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';

const PAID: PaymentStatus[] = [PaymentStatus.CAPTURED, PaymentStatus.AUTHORIZED];

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  async getDashboard(
    query: unknown,
    marketCode?: MarketCode | string | null,
  ): Promise<AdminDashboardResponse> {
    const parsed = analyticsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { days, lowStockThreshold } = parsed.data;
    const resolvedMarket =
      marketCode ?? parsed.data.market ?? null;
    const marketId = resolvedMarket
      ? (await this.marketsService.getByCode(resolvedMarket)).id
      : undefined;
    const { from, to } = this.range(days);
    const where = this.orderWhere(from, to, { marketId });

    const [revenueRows, orderCount, pendingFulfillmentCount, lowStockCount] =
      await Promise.all([
        this.revenueByCurrency(where),
        this.prisma.order.count({
          where: { ...where, paymentStatus: { in: PAID }, status: { not: OrderStatus.CANCELLED } },
        }),
        this.prisma.order.count({
          where: {
            ...where,
            status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] },
          },
        }),
        this.prisma.productVariant.count({
          where: {
            stock: { lte: lowStockThreshold },
            isActive: true,
            ...(marketId ? { product: { marketId } } : {}),
          },
        }),
      ]);

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      marketCode: resolvedMarket ? parseMarketCode(resolvedMarket) : null,
      revenueByCurrency: revenueRows,
      orderCount,
      pendingFulfillmentCount,
      lowStockCount,
    };
  }

  async getAnalytics(
    query: unknown,
    marketCode?: MarketCode | string | null,
  ): Promise<AdminAnalyticsResponse> {
    const parsed = analyticsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { days, currency, market, topLimit, lowStockThreshold } = parsed.data;
    const currencyFilter: Currency | undefined = currency as Currency | undefined;
    // Prefer explicit market (header or query) over currency→market mapping.
    const resolvedMarket = marketCode ?? market ?? null;
    const marketId = resolvedMarket
      ? (await this.marketsService.getByCode(resolvedMarket)).id
      : undefined;
    const { from, to } = this.range(days);
    const where = this.orderWhere(from, to, {
      marketId,
      currency: currencyFilter,
    });

    const [
      revenueByCurrency,
      orderCount,
      cancelledCount,
      pendingFulfillmentCount,
      statusGroups,
      paidOrders,
      topProducts,
      lowStock,
    ] = await Promise.all([
      this.revenueByCurrency(where),
      this.prisma.order.count({
        where: { ...where, paymentStatus: { in: PAID }, status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.count({
        where: { ...where, status: OrderStatus.CANCELLED },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] },
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: {
          ...where,
          paymentStatus: { in: PAID },
          status: { not: OrderStatus.CANCELLED },
        },
        select: { currency: true, total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.topProducts(where, topLimit, currencyFilter),
      this.lowStockItems(lowStockThreshold, marketId),
    ]);

    const averageOrderValueByCurrency: AnalyticsRevenueByCurrency[] = revenueByCurrency.map(
      (row) => ({
        currency: row.currency,
        orderCount: row.orderCount,
        revenue: row.orderCount > 0 ? Math.round(row.revenue / row.orderCount) : 0,
      }),
    );

    const ordersByStatus: AnalyticsOrdersByStatus[] = statusGroups.map((g) => ({
      status: g.status as AdminAnalyticsResponse['ordersByStatus'][number]['status'],
      count: g._count._all,
    }));

    const revenueByDay = this.bucketByDay(paidOrders);

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      currency: currencyFilter ?? null,
      marketCode: resolvedMarket ? parseMarketCode(resolvedMarket) : null,
      revenueByCurrency,
      averageOrderValueByCurrency,
      orderCount,
      cancelledCount,
      pendingFulfillmentCount,
      ordersByStatus,
      revenueByDay,
      topProducts,
      lowStock,
    };
  }

  private range(days: number) {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    from.setUTCHours(0, 0, 0, 0);
    return { from, to };
  }

  private orderWhere(
    from: Date,
    to: Date,
    opts: { marketId?: string; currency?: Currency } = {},
  ): Prisma.OrderWhereInput {
    return {
      createdAt: { gte: from, lte: to },
      ...(opts.marketId ? { marketId: opts.marketId } : {}),
      ...(opts.currency ? { currency: opts.currency as PrismaCurrency } : {}),
    };
  }

  private async revenueByCurrency(
    where: Prisma.OrderWhereInput,
  ): Promise<AnalyticsRevenueByCurrency[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['currency'],
      where: {
        ...where,
        paymentStatus: { in: PAID },
        status: { not: OrderStatus.CANCELLED },
      },
      _sum: { total: true },
      _count: { _all: true },
    });

    return groups.map((g) => ({
      currency: g.currency as Currency,
      revenue: g._sum.total ?? 0,
      orderCount: g._count._all,
    }));
  }

  private async topProducts(
    where: Prisma.OrderWhereInput,
    limit: number,
    currency?: Currency,
  ): Promise<AnalyticsTopProduct[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          ...where,
          paymentStatus: { in: PAID },
          status: { not: OrderStatus.CANCELLED },
        },
      },
      select: {
        quantity: true,
        lineTotal: true,
        productName: true,
        variant: {
          select: {
            productId: true,
            product: { select: { slug: true, name: true } },
          },
        },
      },
    });

    const map = new Map<
      string,
      { productId: string; productName: string; productSlug: string; unitsSold: number; revenue: number }
    >();

    for (const item of items) {
      const productId = item.variant.productId;
      const existing = map.get(productId) ?? {
        productId,
        productName: item.variant.product.name || item.productName,
        productSlug: item.variant.product.slug,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += item.quantity;
      if (currency) existing.revenue += item.lineTotal;
      map.set(productId, existing);
    }

    return [...map.values()]
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, limit);
  }

  private async lowStockItems(
    threshold: number,
    marketId?: string,
  ): Promise<AnalyticsLowStockItem[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        stock: { lte: threshold },
        isActive: true,
        ...(marketId ? { product: { marketId } } : {}),
      },
      orderBy: { stock: 'asc' },
      take: 20,
      include: {
        product: { select: { name: true, slug: true } },
      },
    });

    return variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      variantName: v.name,
      productName: v.product.name,
      productSlug: v.product.slug,
      stock: v.stock,
    }));
  }

  private bucketByDay(
    orders: { currency: PrismaCurrency; total: number; createdAt: Date }[],
  ): AnalyticsDailyPoint[] {
    const buckets = new Map<string, AnalyticsDailyPoint>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const key = `${date}:${order.currency}`;
      const existing = buckets.get(key) ?? {
        date,
        currency: order.currency as Currency,
        revenue: 0,
        orderCount: 0,
      };
      existing.revenue += order.total;
      existing.orderCount += 1;
      buckets.set(key, existing);
    }
    return [...buckets.values()].sort((a, b) =>
      a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date),
    );
  }
}
