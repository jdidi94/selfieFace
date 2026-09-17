import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@prisma/client';
import type {
  StockNotifyListResponse,
  StockNotifySubscribeResponse,
  StockNotifySubscriptionDto,
} from '@lumea/types';
import {
  stockNotifyAdminListQuerySchema,
  stockNotifySubscribeSchema,
} from '@lumea/validation';
import { SesMailService } from '../mail/ses-mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockNotifyService {
  private readonly logger = new Logger(StockNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: SesMailService,
  ) {}

  async subscribe(
    input: unknown,
    opts?: { userId?: string; userEmail?: string },
  ): Promise<StockNotifySubscribeResponse> {
    const parsed = stockNotifySubscribeSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const email = (parsed.data.email ?? opts?.userEmail)?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, name: true, slug: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    let variantId = parsed.data.variantId ?? null;
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId: product.id },
      });
      if (!variant) throw new NotFoundException('Variant not found');
    }

    let customerId: string | null = null;
    if (opts?.userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: opts.userId },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    }

    const existing = await this.prisma.stockNotifySubscription.findFirst({
      where: {
        email,
        productId: product.id,
        variantId,
        notifiedAt: null,
      },
    });
    if (existing) {
      return { ok: true, alreadySubscribed: true };
    }

    await this.prisma.stockNotifySubscription.create({
      data: {
        email,
        productId: product.id,
        variantId,
        customerId,
        locale: (parsed.data.locale as Locale) ?? Locale.en,
      },
    });

    return { ok: true };
  }

  async listAdmin(query: unknown): Promise<StockNotifyListResponse> {
    const parsed = stockNotifyAdminListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { page, pageSize, status, q } = parsed.data;
    const where = {
      ...(status === 'pending'
        ? { notifiedAt: null }
        : status === 'notified'
          ? { notifiedAt: { not: null } }
          : {}),
      ...(q?.trim()
        ? {
            OR: [
              { email: { contains: q.trim(), mode: 'insensitive' as const } },
              {
                product: {
                  name: { contains: q.trim(), mode: 'insensitive' as const },
                },
              },
              {
                variant: {
                  sku: { contains: q.trim(), mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockNotifySubscription.count({ where }),
      this.prisma.stockNotifySubscription.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          variant: { select: { id: true, name: true, sku: true, stock: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.mapDto(row)),
      total,
      page,
      pageSize,
    };
  }

  async markNotified(id: string): Promise<StockNotifySubscriptionDto> {
    const row = await this.prisma.stockNotifySubscription.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        variant: { select: { id: true, name: true, sku: true, stock: true } },
      },
    });
    if (!row) throw new NotFoundException('Subscription not found');

    const updated = await this.prisma.stockNotifySubscription.update({
      where: { id },
      data: { notifiedAt: new Date() },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        variant: { select: { id: true, name: true, sku: true, stock: true } },
      },
    });
    return this.mapDto(updated);
  }

  /** Called when inventory rises from 0 → positive. Sends SES restock mail when configured. */
  async onStockAvailable(variantId: string, previousStock: number, nextStock: number) {
    if (!(previousStock <= 0 && nextStock > 0)) return;

    const pending = await this.prisma.stockNotifySubscription.findMany({
      where: {
        notifiedAt: null,
        OR: [{ variantId }, { variantId: null, product: { variants: { some: { id: variantId } } } }],
      },
      include: {
        product: { select: { name: true, slug: true } },
        variant: { select: { name: true, sku: true } },
      },
    });

    for (const sub of pending) {
      const variantLabel = sub.variant
        ? `${sub.variant.name} (${sub.variant.sku})`
        : null;
      const result = await this.mail.sendRestock({
        to: sub.email,
        productName: sub.product.name,
        productSlug: sub.product.slug,
        variantLabel,
      });

      if (result.sent) {
        await this.prisma.stockNotifySubscription.update({
          where: { id: sub.id },
          data: { notifiedAt: new Date() },
        });
        this.logger.log(
          `[stock-notify] emailed ${sub.email} product=${sub.product.slug} messageId=${result.messageId ?? ''}`,
        );
      } else {
        this.logger.log(
          `[stock-notify] ready email=${sub.email} product=${sub.product.slug} variant=${sub.variant?.sku ?? 'any'} — ${result.skippedReason ?? 'not sent'}; admin can mark notified`,
        );
      }
    }
  }

  private mapDto(row: {
    id: string;
    email: string;
    productId: string;
    variantId: string | null;
    locale: Locale;
    notifiedAt: Date | null;
    createdAt: Date;
    product: { id: string; name: string; slug: string };
    variant: { id: string; name: string; sku: string; stock: number } | null;
  }): StockNotifySubscriptionDto {
    return {
      id: row.id,
      email: row.email,
      productId: row.productId,
      productName: row.product.name,
      productSlug: row.product.slug,
      variantId: row.variantId,
      variantName: row.variant?.name ?? null,
      variantSku: row.variant?.sku ?? null,
      variantStock: row.variant?.stock ?? null,
      locale: row.locale as StockNotifySubscriptionDto['locale'],
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
