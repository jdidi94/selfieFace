import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailLogStatus, Prisma, ProductStatus, SupportTicketStatus } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma/prisma.service';

const FILTER_ENTITIES = ['PRODUCTS', 'ORDERS', 'INVENTORY'] as const;
type FilterEntity = (typeof FILTER_ENTITIES)[number];

@Injectable()
export class AdminProductivityService {
  constructor(private readonly prisma: PrismaService, private readonly markets: MarketsService) {}

  async catalogCompleteness(marketCode: MarketCode | string) {
    const market = await this.markets.getByCode(marketCode);
    const products = await this.prisma.product.findMany({
      where: { marketId: market.id, status: { not: ProductStatus.ARCHIVED } },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        images: { select: { id: true } },
        translations: { select: { locale: true, name: true } },
        variants: { select: { stock: true, isActive: true, prices: { select: { currency: true } } } },
        productTypes: { select: { id: true } },
        skinConcerns: { select: { id: true } },
        ingredients: { select: { id: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 1000,
    });
    const rows = products.map((product) => {
      const locales = new Set(product.translations.filter((t) => t.name.trim()).map((t) => t.locale));
      const issues: string[] = [];
      if (!product.images.length) issues.push('IMAGE');
      if (!['en', 'fr', 'ar'].every((locale) => locales.has(locale as (typeof product.translations)[number]['locale']))) issues.push('TRANSLATION');
      if (!product.variants.length || product.variants.some((v) => !v.prices.some((price) => price.currency === market.currency))) issues.push('PRICE');
      if (!product.variants.some((v) => v.isActive && v.stock > 0)) issues.push('STOCK');
      if (!product.productTypes.length && !product.skinConcerns.length && !product.ingredients.length) issues.push('ATTRIBUTE');
      return { id: product.id, name: product.name, slug: product.slug, status: product.status, issues };
    }).filter((row) => row.issues.length > 0);
    const counts = Object.fromEntries(['IMAGE', 'TRANSLATION', 'PRICE', 'STOCK', 'ATTRIBUTE'].map((issue) => [issue, rows.filter((row) => row.issues.includes(issue)).length]));
    return { items: rows, counts, total: rows.length, scanned: products.length, truncated: products.length === 1000 };
  }

  async operationsDashboard(marketCode: MarketCode | string) {
    const market = await this.markets.getByCode(marketCode);
    const settings = await this.prisma.storeSettings.findUnique({ where: { marketId: market.id } });
    const threshold = settings?.lowStockThreshold ?? 5;
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [ordersNeedingAction, lowStock, openTickets, recentMarketOrders] = await Promise.all([
      this.prisma.order.count({ where: { marketId: market.id, status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.productVariant.count({ where: { isActive: true, stock: { lte: threshold }, product: { marketId: market.id, status: ProductStatus.ACTIVE } } }),
      this.prisma.supportTicket.count({ where: { marketId: market.id, status: { not: SupportTicketStatus.CLOSED } } }),
      this.prisma.order.findMany({ where: { marketId: market.id, createdAt: { gte: since } }, select: { id: true } }),
    ]);
    const failedEmailCount = recentMarketOrders.length
      ? await this.prisma.emailLog.count({ where: { status: EmailLogStatus.FAILED, createdAt: { gte: since }, orderId: { in: recentMarketOrders.map((row) => row.id) } } })
      : 0;
    return {
      ordersNeedingAction,
      lowStock,
      failedEmailsLast7Days: failedEmailCount,
      unresolvedCustomerIssues: openTickets,
      failedEmailWindowDays: 7,
    };
  }

  async listSavedFilters(marketCode: MarketCode | string, userId: string, entity: string) {
    const normalized = this.assertEntity(entity);
    const market = await this.markets.getByCode(marketCode);
    return this.prisma.adminSavedFilter.findMany({
      where: { marketId: market.id, entity: normalized, OR: [{ ownerUserId: userId }, { isShared: true }] },
      orderBy: [{ isShared: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async saveFilter(marketCode: MarketCode | string, userId: string, input: unknown) {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid saved filter');
    const row = input as Record<string, unknown>;
    const entity = this.assertEntity(String(row.entity ?? ''));
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 80) : '';
    if (!name) throw new BadRequestException('Filter name is required');
    if (!row.filters || typeof row.filters !== 'object' || Array.isArray(row.filters)) throw new BadRequestException('Filter values must be an object');
    const market = await this.markets.getByCode(marketCode);
    const existing = await this.prisma.adminSavedFilter.findFirst({ where: { marketId: market.id, ownerUserId: userId, entity, name } });
    const data = { filters: row.filters as Prisma.InputJsonValue, isShared: row.isShared === true };
    return existing
      ? this.prisma.adminSavedFilter.update({ where: { id: existing.id }, data })
      : this.prisma.adminSavedFilter.create({ data: { marketId: market.id, ownerUserId: userId, entity, name, ...data } });
  }

  async deleteFilter(marketCode: MarketCode | string, userId: string, id: string) {
    const market = await this.markets.getByCode(marketCode);
    const result = await this.prisma.adminSavedFilter.deleteMany({ where: { id, marketId: market.id, ownerUserId: userId } });
    if (!result.count) throw new NotFoundException('Saved filter not found or not owned by you');
    return { success: true };
  }

  async listHistory(marketCode: MarketCode | string, query: { entityType?: string; field?: string; take?: string }) {
    const market = await this.markets.getByCode(marketCode);
    const take = Math.min(Math.max(Number(query.take) || 50, 1), 100);
    return this.prisma.adminChangeHistory.findMany({
      where: { marketId: market.id, ...(query.entityType ? { entityType: query.entityType } : {}), ...(query.field ? { field: { contains: query.field, mode: 'insensitive' } } : {}) },
      include: { admin: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async recordChange(input: { marketId: string; adminUserId?: string | null; entityType: string; entityId: string; entityName: string; field: string; before: unknown; after: unknown }) {
    if (JSON.stringify(input.before) === JSON.stringify(input.after)) return;
    return this.prisma.adminChangeHistory.create({
      data: {
        marketId: input.marketId,
        adminUserId: input.adminUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.entityName,
        field: input.field,
        before: input.before == null ? Prisma.JsonNull : input.before as Prisma.InputJsonValue,
        after: input.after == null ? Prisma.JsonNull : input.after as Prisma.InputJsonValue,
      },
    });
  }

  private assertEntity(value: string): FilterEntity {
    if (!FILTER_ENTITIES.includes(value as FilterEntity)) throw new BadRequestException('Unsupported filter type');
    return value as FilterEntity;
  }
}
