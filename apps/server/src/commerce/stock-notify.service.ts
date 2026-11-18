import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Locale } from '@prisma/client';
import type {
  StockNotifyListResponse,
  StockNotifySubscribeResponse,
  StockNotifySubscriptionDto,
} from '@lumea/types';
import { stockNotifyAdminListQuerySchema, stockNotifySubscribeSchema } from '@lumea/validation';
import { SesMailService } from '../mail/ses-mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockNotifyService {
  private readonly logger = new Logger(StockNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: SesMailService,
  ) {}

  async getCustomerSubscriptionStatus(input: { productId?: string; variantId?: string }, userId?: string | null) {
    if (!userId) return { subscribed: false };
    if (!input.productId) throw new BadRequestException('Product is required');
    const customer = await this.prisma.customer.findUnique({ where: { userId }, select: { id: true } });
    if (!customer) return { subscribed: false };
    const subscribed = await this.prisma.stockNotifySubscription.findFirst({
      where: {
        customerId: customer.id,
        productId: input.productId,
        variantId: input.variantId || null,
        notifiedAt: null,
      },
      select: { id: true },
    });
    return { subscribed: Boolean(subscribed) };
  }

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

    if (opts?.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: opts.userId },
        select: { emailVerifiedAt: true },
      });
      if (!user?.emailVerifiedAt) {
        throw new BadRequestException(
          'Verify your account email before requesting a stock notification',
        );
      }
    } else {
      const token = this.guestVerificationToken({
        email,
        productId: parsed.data.productId,
        variantId: parsed.data.variantId ?? null,
        locale: parsed.data.locale ?? 'en',
        expiresAt: Date.now() + 86_400_000,
      });
      const verifyUrl = `${this.mail.getStorefrontUrl()}/stock-notify/verify?token=${encodeURIComponent(token)}`;
      await this.mail.sendRaw({
        to: email,
        subject: 'Confirm your back-in-stock request',
        text: `Confirm your request: ${verifyUrl}`,
        html: `<p>Confirm your back-in-stock request.</p><p><a href="${verifyUrl}">Confirm email</a></p>`,
      });
      return { ok: true, requiresVerification: true };
    }

    return this.createSubscription({
      email,
      productId: parsed.data.productId,
      variantId: parsed.data.variantId,
      locale: parsed.data.locale,
      userId: opts.userId,
    });
  }

  async verifyGuest(token: string): Promise<StockNotifySubscribeResponse> {
    const payload = this.readGuestVerificationToken(token);
    if (!payload || payload.expiresAt < Date.now())
      throw new BadRequestException('This verification link is invalid or expired');
    return { ...(await this.createSubscription(payload)), productId: payload.productId, variantId: payload.variantId };
  }

  private async createSubscription(input: {
    email: string;
    productId: string;
    variantId?: string | null;
    locale?: string;
    userId?: string;
  }): Promise<StockNotifySubscribeResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, slug: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const variantId = input.variantId ?? null;
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId: product.id },
      });
      if (!variant) throw new NotFoundException('Variant not found');
    }
    let customerId: string | null = null;
    if (input.userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: input.userId },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    }

    const existing = await this.prisma.stockNotifySubscription.findFirst({
      where: {
        email: input.email,
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
        email: input.email,
        productId: product.id,
        variantId,
        customerId,
        locale: (input.locale as Locale) ?? Locale.en,
      },
    });

    return { ok: true };
  }

  private guestVerificationToken(payload: {
    email: string;
    productId: string;
    variantId: string | null;
    locale: string;
    expiresAt: number;
  }): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${createHmac('sha256', this.tokenSecret()).update(encoded).digest('base64url')}`;
  }

  private readGuestVerificationToken(
    token: string,
  ): {
    email: string;
    productId: string;
    variantId: string | null;
    locale: string;
    expiresAt: number;
  } | null {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = createHmac('sha256', this.tokenSecret()).update(encoded).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      return typeof payload.email === 'string' &&
        typeof payload.productId === 'string' &&
        typeof payload.expiresAt === 'number'
        ? payload
        : null;
    } catch {
      return null;
    }
  }

  private tokenSecret(): string {
    return (
      process.env.STOCK_NOTIFY_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'development-stock-notify-secret'
    );
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
        OR: [
          { variantId },
          { variantId: null, product: { variants: { some: { id: variantId } } } },
        ],
      },
      include: {
        product: { select: { name: true, slug: true } },
        variant: { select: { name: true, sku: true } },
      },
    });

    for (const sub of pending) {
      const variantLabel = sub.variant ? `${sub.variant.name} (${sub.variant.sku})` : null;
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
