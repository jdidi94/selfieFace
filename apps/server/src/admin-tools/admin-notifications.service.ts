import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { MarketCode } from '@lumea/types';
import type { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SesMailService } from '../mail/ses-mail.service';
import { parseMarketCode } from '../markets/market.util';

type NotificationInput = { marketId: string; marketCode: string; kind: string; title: string; body: string; actionUrl?: string; dedupeKey: string; source?: Record<string, unknown> };

@Injectable()
export class AdminNotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminNotificationsService.name);
  private io: Server | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastScanDate = '';

  constructor(private readonly prisma: PrismaService, private readonly mail: SesMailService) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.scanIfDue(); }, 60 * 60 * 1000);
    this.timer.unref?.();
    void this.scanIfDue();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  attachSocket(io: Server) { this.io = io; }

  private async scanIfDue() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastScanDate === today) return;
    this.lastScanDate = today;
    try {
      const markets = await this.prisma.market.findMany({ where: { enabled: true }, select: { id: true, code: true } });
      for (const market of markets) await this.scanMarket(market.id, market.code);
    } catch (error) {
      this.lastScanDate = '';
      this.logger.error(`Daily insight scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async upsert(input: NotificationInput) {
    const where = { marketId_dedupeKey: { marketId: input.marketId, dedupeKey: input.dedupeKey } };
    const existing = await this.prisma.adminNotification.findUnique({ where });
    const data = { kind: input.kind, title: input.title, body: input.body, actionUrl: input.actionUrl ?? null, ...(input.source ? { source: input.source as Prisma.InputJsonValue } : {}) };
    let row;
    if (existing) {
      row = await this.prisma.adminNotification.update({
        where,
        data: { ...data, ...(existing.status === 'RESOLVED' ? { status: 'OPEN' } : {}) },
      });
    } else {
      row = await this.prisma.adminNotification.create({ data: { marketId: input.marketId, dedupeKey: input.dedupeKey, ...data } });
    }
    if (!existing || existing.status === 'RESOLVED') this.io?.to(`market:${input.marketCode}`).emit('admin:notification', row);
    return { row, isNew: !existing || existing.status === 'RESOLVED' };
  }

  private async scanMarket(marketId: string, marketCode: string) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { marketId } });
    if (settings?.adminInsightsEnabled === false) return;
    const newRows: { title: string; body: string }[] = [];
    const threshold = settings?.lowStockThreshold ?? 5;
    const lowStock = await this.prisma.productVariant.findMany({
      where: { isActive: true, stock: { lte: threshold }, product: { marketId, status: 'ACTIVE' } },
      select: { id: true, name: true, sku: true, stock: true, product: { select: { id: true, name: true, slug: true } } },
      take: 100,
      orderBy: { stock: 'asc' },
    });
    for (const variant of lowStock) {
      const result = await this.upsert({
        marketId, marketCode, kind: 'LOW_STOCK', dedupeKey: `LOW_STOCK:${variant.id}`,
        title: `Low stock: ${variant.product.name}`,
        body: `${variant.name} (${variant.sku}) has ${variant.stock} units left. Reorder or review availability.`,
        actionUrl: '/catalog/inventory', source: { variantId: variant.id, productId: variant.product.id, stock: variant.stock, threshold },
      });
      if (result.isNew) newRows.push({ title: result.row.title, body: result.row.body });
    }
    const lowIds = lowStock.map((item) => item.id);
    await this.prisma.adminNotification.updateMany({
      where: { marketId, kind: 'LOW_STOCK', status: { in: ['OPEN', 'SNOOZED'] }, ...(lowIds.length ? { dedupeKey: { notIn: lowIds.map((id) => `LOW_STOCK:${id}`) } } : {}) },
      data: { status: 'RESOLVED' },
    });

    const incompleteCount = await this.prisma.product.count({
      where: { marketId, status: 'ACTIVE', OR: [{ images: { none: {} } }, { description: null }, { description: '' }] },
    });
    if (incompleteCount > 0) {
      const result = await this.upsert({
        marketId, marketCode, kind: 'CATALOG_QUALITY', dedupeKey: 'CATALOG_QUALITY',
        title: `${incompleteCount} active products need catalog attention`,
        body: 'Some live products are missing a photo or product description. Completing these details can help shoppers make a decision.',
        actionUrl: '/catalog/products', source: { incompleteProductCount: incompleteCount },
      });
      if (result.isNew) newRows.push({ title: result.row.title, body: result.row.body });
    } else {
      await this.prisma.adminNotification.updateMany({ where: { marketId, dedupeKey: 'CATALOG_QUALITY', status: { in: ['OPEN', 'SNOOZED'] } }, data: { status: 'RESOLVED' } });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const [recentOrders, priorOrders] = await Promise.all([
      this.prisma.order.count({ where: { marketId, createdAt: { gte: weekAgo }, status: { not: 'CANCELLED' }, paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] } } }),
      this.prisma.order.count({ where: { marketId, createdAt: { gte: twoWeeksAgo, lt: weekAgo }, status: { not: 'CANCELLED' }, paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] } } }),
    ]);
    if (priorOrders >= 5 && recentOrders < priorOrders * 0.75) {
      const dropPercent = Math.round((1 - recentOrders / priorOrders) * 100);
      const result = await this.upsert({
        marketId, marketCode, kind: 'SALES_TREND', dedupeKey: 'SALES_TREND',
        title: 'Orders are down compared with last week',
        body: `Orders over the last 7 days are down ${dropPercent}% (${recentOrders} vs ${priorOrders}). Review campaign reach and consider a targeted promotion.`,
        actionUrl: '/marketing/promotions', source: { recentOrders, priorOrders, dropPercent },
      });
      if (result.isNew) newRows.push({ title: result.row.title, body: result.row.body });
    } else {
      await this.prisma.adminNotification.updateMany({ where: { marketId, dedupeKey: 'SALES_TREND', status: { in: ['OPEN', 'SNOOZED'] } }, data: { status: 'RESOLVED' } });
    }

    if (newRows.length && settings?.adminInsightEmailsEnabled) await this.sendDigest(marketId, newRows);
  }

  private async sendDigest(marketId: string, rows: { title: string; body: string }[]) {
    const to = process.env.SES_ADMIN_NOTIFY_EMAIL?.trim() || process.env.ADMIN_NOTIFY_EMAIL?.trim();
    if (!to) return;
    const list = rows.map((row) => `• ${row.title}: ${row.body}`).join('\n');
    const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const html = `<h2>Store reminders</h2><ul>${rows.map((row) => `<li><strong>${escape(row.title)}</strong><br>${escape(row.body)}</li>`).join('')}</ul>`;
    const result = await this.mail.sendRaw({ to, subject: 'Store reminders', text: list, html, marketId });
    if (result.sent) {
      await this.prisma.adminNotification.updateMany({ where: { marketId, status: 'OPEN', emailedAt: null }, data: { emailedAt: new Date() } });
    }
  }

  async list(marketCode: MarketCode | string, status?: string) {
    const market = await this.prisma.market.findUnique({ where: { code: parseMarketCode(marketCode) } });
    if (!market) return { items: [], unreadCount: 0 };
    const where = status
      ? { marketId: market.id, status }
      : { marketId: market.id, status: { in: ['OPEN', 'SNOOZED'] }, OR: [{ dueAt: null }, { dueAt: { lte: new Date() } }] };
    const [items, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({ where, orderBy: [{ createdAt: 'desc' }], take: 100 }),
      this.prisma.adminNotification.count({ where: { marketId: market.id, status: 'OPEN' } }),
    ]);
    return { items, unreadCount };
  }

  async setStatus(marketCode: MarketCode | string, id: string, status: string) {
    if (!['OPEN', 'READ', 'DISMISSED', 'SNOOZED'].includes(status)) throw new BadRequestException('Invalid notification status');
    const market = await this.prisma.market.findUnique({ where: { code: parseMarketCode(marketCode) } });
    if (!market) throw new NotFoundException('Market not found');
    const result = await this.prisma.adminNotification.updateMany({ where: { id, marketId: market.id }, data: { status, ...(status === 'SNOOZED' ? { dueAt: new Date(Date.now() + 86400000) } : { dueAt: null }) } });
    if (!result.count) throw new NotFoundException('Notification not found');
    return this.prisma.adminNotification.findUnique({ where: { id } });
  }

  async analyze(marketCode: MarketCode | string) {
    const result = await this.list(marketCode, 'OPEN');
    const market = await this.prisma.market.findUnique({ where: { code: parseMarketCode(marketCode) }, include: { settings: true } });
    if (!market) throw new NotFoundException('Market not found');
    const threshold = market.settings?.lowStockThreshold ?? 5;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const [activeProducts, incompleteProducts, lowStockVariants, recentOrders, priorOrders] = await Promise.all([
      this.prisma.product.count({ where: { marketId: market.id, status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { marketId: market.id, status: 'ACTIVE', OR: [{ images: { none: {} } }, { description: null }, { description: '' }] } }),
      this.prisma.productVariant.count({ where: { isActive: true, stock: { lte: threshold }, product: { marketId: market.id, status: 'ACTIVE' } } }),
      this.prisma.order.count({ where: { marketId: market.id, createdAt: { gte: weekAgo }, status: { not: 'CANCELLED' }, paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] } } }),
      this.prisma.order.count({ where: { marketId: market.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo }, status: { not: 'CANCELLED' }, paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] } } }),
    ]);
    const insights = [
      `Active products: ${activeProducts}; active products missing a photo or description: ${incompleteProducts}.`,
      `Active variants at or below the stock threshold (${threshold}): ${lowStockVariants}.`,
      `Paid or authorized orders in the last 7 days: ${recentOrders}; previous 7 days: ${priorOrders}.`,
      ...result.items.map((item) => `${item.title}: ${item.body}`),
    ];
    if (priorOrders >= 5 && recentOrders < priorOrders * 0.75) insights.push('Suggested action: review recent campaign reach and consider a targeted promotion for an in-stock product group.');
    if (incompleteProducts > 0) insights.push('Suggested action: complete missing product photos or descriptions to improve product pages.');
    if (lowStockVariants > 0) insights.push('Suggested action: review reorder needs for variants at or below the stock threshold.');
    const context = insights.join('\n');
    const key = process.env.GROK_API_KEY?.trim();
    if (!key) return { provider: 'rules', analysis: context };
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.GROK_MODEL || 'grok-3-mini', temperature: 0.2, messages: [
          { role: 'system', content: 'You are a concise e-commerce operations adviser. Use only the supplied store signals. Offer practical, low-risk actions. Do not invent data, promise outcomes, or suggest changing prices without admin review.' },
          { role: 'user', content: `Summarize these current store signals and suggest up to three actions:\n${context}` },
        ] }),
      });
      if (!response.ok) throw new Error(`Grok request failed (${response.status})`);
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      return { provider: 'grok', analysis: payload.choices?.[0]?.message?.content?.trim() || context };
    } catch (error) {
      this.logger.warn(`Optional Grok analysis unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return { provider: 'rules', analysis: context };
    }
  }
}
