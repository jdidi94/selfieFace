import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouponProductScope,
  CouponType,
  Currency,
  ReviewStatus,
  type Coupon,
  type Prisma,
} from '@prisma/client';
import type { ActiveCouponDto, CouponDto, MarketCode } from '@lumea/types';
import {
  CouponProductScope as SharedCouponProductScope,
  CouponType as SharedCouponType,
} from '@lumea/types';
import { couponUpsertSchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { marketCodeFromCurrencyValue, parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';

const NEW_PRODUCT_DAYS = 30;

export type CouponLineInput = {
  productId: string;
  lineTotal: number;
};

type ProductMatchContext = {
  id: string;
  tags: string[];
  createdAt: Date;
  minPriceUsd: number;
  averageRating: number | null;
};

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  async listAdmin(marketCode: MarketCode | string = 'OTHER'): Promise<CouponDto[]> {
    const market = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.coupon.findMany({
      where: { marketId: market.id },
      include: { market: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => this.mapCoupon(c));
  }

  async getAdmin(id: string): Promise<CouponDto> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.mapCoupon(coupon);
  }

  async create(input: unknown, marketCode: MarketCode | string = 'OTHER'): Promise<CouponDto> {
    const parsed = couponUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(parsed.data.marketCode ?? marketCode);
    const market = await this.marketsService.getByCode(code);
    const data = { ...this.toDbData(parsed.data), marketId: market.id };
    try {
      const coupon = await this.prisma.coupon.create({
        data,
        include: { market: true },
      });
      return this.mapCoupon(coupon);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Coupon code already exists');
      }
      throw err;
    }
  }

  async update(id: string, input: unknown): Promise<CouponDto> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    const parsed = couponUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = this.toDbData(parsed.data);
    try {
      const coupon = await this.prisma.coupon.update({
        where: { id },
        data,
        include: { market: true },
      });
      return this.mapCoupon(coupon);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Coupon code already exists');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.delete({ where: { id } });
  }

  /** Public list of currently active coupons for the visitor’s market. */
  async listActivePublic(currency?: string | null): Promise<ActiveCouponDto[]> {
    const market = await this.marketsService.getByCode(
      marketCodeFromCurrencyValue(currency),
    );
    const now = new Date();
    const rows = await this.prisma.coupon.findMany({
      where: {
        marketId: market.id,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ endsAt: 'asc' }, { code: 'asc' }],
      take: 12,
    });
    return rows
      .filter((c) => c.maxUses == null || c.usedCount < c.maxUses)
      .map((c) => ({
        code: c.code,
        description: c.description,
        type:
          c.type === CouponType.PERCENT
            ? SharedCouponType.PERCENT
            : SharedCouponType.FIXED,
        percentOff: c.percentOff,
        amountOff: c.amountOff,
        minSubtotal: c.minSubtotal,
        endsAt: c.endsAt?.toISOString() ?? null,
      }));
  }

  async findByCode(code: string, currency?: string | null): Promise<Coupon | null> {
    const market = await this.marketsService.getByCode(marketCodeFromCurrencyValue(currency));
    return this.prisma.coupon.findUnique({
      where: {
        marketId_code: {
          marketId: market.id,
          code: code.trim().toUpperCase(),
        },
      },
    });
  }

  /**
   * Validates a coupon for the given cart and returns the discount amount.
   * When `lines` are provided, INCLUDE/EXCLUDE product rules are applied.
   */
  async assertApplicable(
    coupon: Coupon,
    opts: {
      subtotal: number;
      currency: Currency;
      customerId?: string | null;
      lines?: CouponLineInput[];
    },
  ): Promise<number> {
    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is not active');
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    if (coupon.type === CouponType.FIXED) {
      if (coupon.amountOff == null) {
        throw new BadRequestException('This coupon is not available in your currency');
      }
    }

    if (opts.customerId && coupon.maxUsesPerCustomer != null) {
      const used = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, customerId: opts.customerId },
      });
      if (used >= coupon.maxUsesPerCustomer) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    const eligibleSubtotal = await this.eligibleSubtotal(coupon, opts);
    if (eligibleSubtotal <= 0 && coupon.productScope !== CouponProductScope.ALL) {
      throw new BadRequestException(
        'This coupon does not apply to the products in your bag',
      );
    }

    const min = coupon.minSubtotal;
    const minBase =
      coupon.productScope === CouponProductScope.ALL ? opts.subtotal : eligibleSubtotal;
    if (min != null && minBase < min) {
      throw new BadRequestException(
        'Your bag total is below the minimum required for this coupon',
      );
    }

    return this.computeDiscount(coupon, eligibleSubtotal, opts.currency);
  }

  computeDiscount(coupon: Coupon, subtotal: number, currency: Currency): number {
    if (subtotal <= 0) return 0;
    if (coupon.type === CouponType.PERCENT) {
      const pct = coupon.percentOff ?? 0;
      return Math.min(subtotal, Math.round((subtotal * pct) / 100));
    }
    const amount = coupon.amountOff ?? 0;
    return Math.min(subtotal, amount);
  }

  private async eligibleSubtotal(
    coupon: Coupon,
    opts: { subtotal: number; currency: Currency; lines?: CouponLineInput[] },
  ): Promise<number> {
    if (
      coupon.productScope === CouponProductScope.ALL ||
      !opts.lines?.length ||
      !this.hasProductFilters(coupon)
    ) {
      return opts.subtotal;
    }

    const contexts = await this.loadProductContexts(opts.lines.map((l) => l.productId));
    let eligible = 0;
    for (const line of opts.lines) {
      const ctx = contexts.get(line.productId);
      if (!ctx) continue;
      const matches = this.productMatches(coupon, ctx);
      const include =
        coupon.productScope === CouponProductScope.INCLUDE ? matches : !matches;
      if (include) eligible += line.lineTotal;
    }
    return eligible;
  }

  private hasProductFilters(coupon: Coupon): boolean {
    return (
      coupon.productTags.length > 0 ||
      coupon.productIds.length > 0 ||
      coupon.ruleIsNew ||
      coupon.ruleMinPriceUsd != null ||
      coupon.ruleMinRating != null
    );
  }

  private async loadProductContexts(
    productIds: string[],
  ): Promise<Map<string, ProductMatchContext>> {
    const unique = [...new Set(productIds)];
    const map = new Map<string, ProductMatchContext>();
    if (!unique.length) return map;

    const products = await this.prisma.product.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        tags: true,
        createdAt: true,
        variants: {
          where: { isActive: true },
          select: {
            prices: {
              where: { currency: Currency.USD },
              select: { amount: true },
            },
          },
        },
      },
    });

    const ratingGroups = await this.prisma.review.groupBy({
      by: ['productId'],
      where: {
        productId: { in: unique },
        status: ReviewStatus.APPROVED,
      },
      _avg: { rating: true },
    });
    const ratings = new Map(
      ratingGroups.map((r) => [
        r.productId,
        r._avg.rating != null ? Math.round(r._avg.rating * 10) / 10 : null,
      ]),
    );

    for (const p of products) {
      const amounts = p.variants.flatMap((v) => v.prices.map((pr) => pr.amount));
      map.set(p.id, {
        id: p.id,
        tags: p.tags ?? [],
        createdAt: p.createdAt,
        minPriceUsd: amounts.length ? Math.min(...amounts) : 0,
        averageRating: ratings.get(p.id) ?? null,
      });
    }
    return map;
  }

  private productMatches(coupon: Coupon, product: ProductMatchContext): boolean {
    const tagSet = new Set(coupon.productTags.map((t) => t.toLowerCase()));
    const idSet = new Set(coupon.productIds);
    const hasTagOrIdFilter = tagSet.size > 0 || idSet.size > 0;

    let matches = true;
    if (hasTagOrIdFilter) {
      const tagHit = product.tags.some((t) => tagSet.has(t.toLowerCase()));
      const idHit = idSet.has(product.id);
      matches = tagHit || idHit;
    }

    if (coupon.ruleIsNew) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - NEW_PRODUCT_DAYS);
      matches = matches && product.createdAt >= cutoff;
    }
    if (coupon.ruleMinPriceUsd != null) {
      matches = matches && product.minPriceUsd >= coupon.ruleMinPriceUsd;
    }
    if (coupon.ruleMinRating != null) {
      matches =
        matches &&
        product.averageRating != null &&
        product.averageRating >= coupon.ruleMinRating;
    }
    return matches;
  }

  mapCoupon(coupon: Coupon & { market?: { code: string } | null }): CouponDto {
    return {
      id: coupon.id,
      code: coupon.code,
      marketCode: coupon.market?.code
        ? (parseMarketCode(coupon.market.code) as MarketCode)
        : undefined,
      type:
        coupon.type === CouponType.PERCENT
          ? SharedCouponType.PERCENT
          : SharedCouponType.FIXED,
      description: coupon.description,
      percentOff: coupon.percentOff,
      amountOff: coupon.amountOff,
      minSubtotal: coupon.minSubtotal,
      maxUses: coupon.maxUses,
      maxUsesPerCustomer: coupon.maxUsesPerCustomer,
      usedCount: coupon.usedCount,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      isActive: coupon.isActive,
      productScope:
        coupon.productScope === CouponProductScope.INCLUDE
          ? SharedCouponProductScope.INCLUDE
          : coupon.productScope === CouponProductScope.EXCLUDE
            ? SharedCouponProductScope.EXCLUDE
            : SharedCouponProductScope.ALL,
      productTags: coupon.productTags ?? [],
      productIds: coupon.productIds ?? [],
      ruleIsNew: coupon.ruleIsNew,
      ruleMinPriceUsd: coupon.ruleMinPriceUsd,
      ruleMinRating: coupon.ruleMinRating,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    opts: { couponId: string; customerId: string; orderId: string },
  ): Promise<void> {
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: opts.couponId } });
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.maxUsesPerCustomer != null) {
      const used = await tx.couponRedemption.count({
        where: { couponId: opts.couponId, customerId: opts.customerId },
      });
      if (used >= coupon.maxUsesPerCustomer) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    await tx.couponRedemption.create({
      data: {
        couponId: opts.couponId,
        customerId: opts.customerId,
        orderId: opts.orderId,
      },
    });
    await tx.coupon.update({
      where: { id: opts.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  private toDbData(data: {
    code: string;
    type: 'PERCENT' | 'FIXED';
    description?: string | null;
    percentOff?: number | null;
    amountOff?: number | null;
    minSubtotal?: number | null;
    maxUses?: number | null;
    maxUsesPerCustomer?: number | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    isActive?: boolean;
    productScope?: 'ALL' | 'INCLUDE' | 'EXCLUDE';
    productTags?: string[];
    productIds?: string[];
    ruleIsNew?: boolean;
    ruleMinPriceUsd?: number | null;
    ruleMinRating?: number | null;
  }) {
    const isPercent = data.type === 'PERCENT';
    const tags = (data.productTags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return {
      code: data.code.trim().toUpperCase(),
      type: isPercent ? CouponType.PERCENT : CouponType.FIXED,
      description: data.description?.trim() ? data.description.trim() : null,
      percentOff: isPercent ? (data.percentOff ?? null) : null,
      amountOff: isPercent ? null : (data.amountOff ?? null),
      minSubtotal: data.minSubtotal ?? null,
      maxUses: data.maxUses ?? null,
      maxUsesPerCustomer: data.maxUsesPerCustomer ?? null,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      isActive: data.isActive ?? true,
      productScope:
        data.productScope === 'INCLUDE'
          ? CouponProductScope.INCLUDE
          : data.productScope === 'EXCLUDE'
            ? CouponProductScope.EXCLUDE
            : CouponProductScope.ALL,
      productTags: tags,
      productIds: [...new Set(data.productIds ?? [])],
      ruleIsNew: data.ruleIsNew ?? false,
      ruleMinPriceUsd: data.ruleMinPriceUsd ?? null,
      ruleMinRating: data.ruleMinRating ?? null,
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }
}
