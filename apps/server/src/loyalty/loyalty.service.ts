import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoyaltyLedgerType,
  PaymentStatus,
  Prisma,
  type StoreSettings,
} from '@prisma/client';
import {
  LoyaltyLedgerType as SharedLedgerType,
  type LoyaltyAccountDto,
  type LoyaltyConfigDto,
  type LoyaltyLedgerEntryDto,
} from '@lumea/types';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettings(): Promise<StoreSettings> {
    const market = await this.prisma.market.findUnique({ where: { code: 'OTHER' } });
    if (!market) {
      throw new Error('OTHER market is missing — run migrations / seed');
    }
    return this.prisma.storeSettings.upsert({
      where: { id: 'OTHER' },
      create: { id: 'OTHER', marketId: market.id },
      update: {},
    });
  }

  toConfig(settings: StoreSettings): LoyaltyConfigDto {
    return {
      enabled: settings.loyaltyEnabled,
      pointsPerMajorUnit: settings.loyaltyPointsPerMajorUnit,
      pointValueMinor: settings.loyaltyPointValueMinor,
      minOrderMinor: settings.loyaltyMinOrderMinor,
      maxRedeemBps: settings.loyaltyMaxRedeemBps,
      signupBonusPoints: settings.loyaltySignupBonusPoints,
    };
  }

  async getPublicConfig(): Promise<LoyaltyConfigDto> {
    const settings = await this.getSettings();
    return this.toConfig(settings);
  }

  /**
   * Earn points = floor(merchandiseNetMinor / 100) * pointsPerMajorUnit.
   * Merchandise net = subtotal − discount (coupon + loyalty).
   */
  computeEarnPoints(merchandiseNetMinor: number, settings: StoreSettings): number {
    if (!settings.loyaltyEnabled || settings.loyaltyPointsPerMajorUnit <= 0) return 0;
    const majorUnits = Math.floor(Math.max(0, merchandiseNetMinor) / 100);
    return majorUnits * settings.loyaltyPointsPerMajorUnit;
  }

  /**
   * Discount (minor units) for redeeming `points`, capped by balance rules and max %.
   * `subtotalAfterCoupon` is merchandise after coupon, before loyalty.
   */
  computeRedeemDiscount(
    points: number,
    subtotalAfterCoupon: number,
    settings: StoreSettings,
  ): number {
    if (!settings.loyaltyEnabled || points <= 0 || settings.loyaltyPointValueMinor <= 0) {
      return 0;
    }
    if (
      settings.loyaltyMinOrderMinor != null &&
      subtotalAfterCoupon < settings.loyaltyMinOrderMinor
    ) {
      return 0;
    }
    let discount = points * settings.loyaltyPointValueMinor;
    discount = Math.min(discount, Math.max(0, subtotalAfterCoupon));
    if (settings.loyaltyMaxRedeemBps != null && settings.loyaltyMaxRedeemBps > 0) {
      const maxByBps = Math.floor(
        (subtotalAfterCoupon * settings.loyaltyMaxRedeemBps) / 10_000,
      );
      discount = Math.min(discount, maxByBps);
    }
    // Snap down to whole points worth so we don't over-claim fractional points.
    const maxPoints = Math.floor(discount / settings.loyaltyPointValueMinor);
    return maxPoints * settings.loyaltyPointValueMinor;
  }

  /** Points actually needed for a computed discount (may be < requested after caps). */
  pointsForDiscount(discountMinor: number, settings: StoreSettings): number {
    if (discountMinor <= 0 || settings.loyaltyPointValueMinor <= 0) return 0;
    return Math.floor(discountMinor / settings.loyaltyPointValueMinor);
  }

  assertRedeemAllowed(
    settings: StoreSettings,
    opts: {
      points: number;
      balance: number;
      subtotalAfterCoupon: number;
    },
  ): { points: number; discount: number } {
    if (!settings.loyaltyEnabled) {
      throw new BadRequestException('Loyalty program is disabled');
    }
    if (opts.points < 0) throw new BadRequestException('Invalid loyalty points');
    if (opts.points === 0) return { points: 0, discount: 0 };
    if (opts.points > opts.balance) {
      throw new BadRequestException('Not enough loyalty points');
    }
    if (
      settings.loyaltyMinOrderMinor != null &&
      opts.subtotalAfterCoupon < settings.loyaltyMinOrderMinor
    ) {
      throw new BadRequestException('Order total is below the loyalty minimum');
    }
    const discount = this.computeRedeemDiscount(
      opts.points,
      opts.subtotalAfterCoupon,
      settings,
    );
    const points = this.pointsForDiscount(discount, settings);
    if (points <= 0) {
      throw new BadRequestException('Loyalty redemption is not available for this bag');
    }
    if (points < opts.points) {
      // Cap silently to what rules allow when applying from cart map; callers that
      // want hard failure on over-request can compare. For apply endpoint we accept caps.
      return { points, discount };
    }
    return { points: opts.points, discount };
  }

  async getAccountForUser(userId: string): Promise<LoyaltyAccountDto> {
    const settings = await this.getSettings();
    const config = this.toConfig(settings);
    if (!settings.loyaltyEnabled) {
      return { balance: 0, config, ledger: [] };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true, isGuest: true },
    });
    if (!customer || customer.isGuest) {
      throw new ForbiddenException('Loyalty requires a registered customer account');
    }

    const account = await this.ensureAccount(customer.id, settings);
    const ledger = await this.prisma.loyaltyLedgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return {
      balance: account.balance,
      config,
      ledger: ledger.map((e) => this.mapLedger(e)),
    };
  }

  async getBalanceForCustomer(customerId: string): Promise<number | null> {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
      select: { balance: true },
    });
    return account?.balance ?? null;
  }

  /**
   * Create wallet if missing; grant signup bonus once when loyalty is enabled.
   */
  async ensureAccount(
    customerId: string,
    settings?: StoreSettings,
  ): Promise<{ id: string; balance: number; customerId: string }> {
    const existing = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });
    if (existing) return existing;

    const s = settings ?? (await this.getSettings());
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.loyaltyAccount.create({
        data: { customerId, balance: 0 },
      });
      if (s.loyaltyEnabled && s.loyaltySignupBonusPoints > 0) {
        return this.applyLedger(tx, {
          accountId: created.id,
          type: LoyaltyLedgerType.SIGNUP_BONUS,
          points: s.loyaltySignupBonusPoints,
          note: 'Welcome bonus',
        });
      }
      return created;
    });
  }

  /**
   * Earn for a committed order. Eligible when payment is CAPTURED (card)
   * or AUTHORIZED (COD reserved). Idempotent via unique (orderId, EARN_ORDER).
   */
  async earnForCommittedOrder(orderId: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.loyaltyEnabled) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) return;
    if (order.customer.isGuest || !order.customer.userId) return;
    if (
      order.paymentStatus !== PaymentStatus.CAPTURED &&
      order.paymentStatus !== PaymentStatus.AUTHORIZED
    ) {
      return;
    }
    if (order.loyaltyPointsEarned > 0) return;

    const existing = await this.prisma.loyaltyLedgerEntry.findUnique({
      where: {
        orderId_type: { orderId, type: LoyaltyLedgerType.EARN_ORDER },
      },
    });
    if (existing) return;

    const merchandiseNet = Math.max(0, order.subtotal - order.discount);
    const points = this.computeEarnPoints(merchandiseNet, settings);
    if (points <= 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { loyaltyPointsEarned: 0 },
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const again = await tx.loyaltyLedgerEntry.findUnique({
        where: {
          orderId_type: { orderId, type: LoyaltyLedgerType.EARN_ORDER },
        },
      });
      if (again) return;

      const account = await this.ensureAccountInTx(tx, order.customerId, settings);
      await this.applyLedger(tx, {
        accountId: account.id,
        type: LoyaltyLedgerType.EARN_ORDER,
        points,
        orderId,
        note: `Earned on order ${order.number}`,
      });
      await tx.order.update({
        where: { id: orderId },
        data: { loyaltyPointsEarned: points },
      });
    });
  }

  /**
   * Debit redeem points when the order is created. Idempotent per order.
   */
  async debitRedeemInTx(
    tx: Tx,
    opts: {
      customerId: string;
      orderId: string;
      points: number;
      orderNumber: string;
      settings: StoreSettings;
    },
  ): Promise<void> {
    if (opts.points <= 0) return;
    if (!opts.settings.loyaltyEnabled) {
      throw new BadRequestException('Loyalty program is disabled');
    }

    const account = await this.ensureAccountInTx(tx, opts.customerId, opts.settings);
    if (account.balance < opts.points) {
      throw new BadRequestException('Not enough loyalty points');
    }

    await this.applyLedger(tx, {
      accountId: account.id,
      type: LoyaltyLedgerType.REDEEM_ORDER,
      points: -opts.points,
      orderId: opts.orderId,
      note: `Redeemed on order ${opts.orderNumber}`,
    });
  }

  /**
   * On cancel/refund: reverse earn (if any) and restore redeemed points.
   */
  async reverseForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order || order.customer.isGuest) return;

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { customerId: order.customerId },
      });
      if (!account) return;

      const earn = await tx.loyaltyLedgerEntry.findUnique({
        where: {
          orderId_type: { orderId, type: LoyaltyLedgerType.EARN_ORDER },
        },
      });
      const earnReversal = await tx.loyaltyLedgerEntry.findUnique({
        where: {
          orderId_type: { orderId, type: LoyaltyLedgerType.EARN_REVERSAL },
        },
      });
      if (earn && !earnReversal && earn.points > 0) {
        await this.applyLedger(tx, {
          accountId: account.id,
          type: LoyaltyLedgerType.EARN_REVERSAL,
          points: -earn.points,
          orderId,
          note: `Reversed earn for order ${order.number}`,
        });
        await tx.order.update({
          where: { id: orderId },
          data: { loyaltyPointsEarned: 0 },
        });
      }

      const redeem = await tx.loyaltyLedgerEntry.findUnique({
        where: {
          orderId_type: { orderId, type: LoyaltyLedgerType.REDEEM_ORDER },
        },
      });
      const restore = await tx.loyaltyLedgerEntry.findUnique({
        where: {
          orderId_type: { orderId, type: LoyaltyLedgerType.REDEEM_RESTORE },
        },
      });
      if (redeem && !restore && redeem.points < 0) {
        await this.applyLedger(tx, {
          accountId: account.id,
          type: LoyaltyLedgerType.REDEEM_RESTORE,
          points: -redeem.points,
          orderId,
          note: `Restored redeem for order ${order.number}`,
        });
      }
    });
  }

  private async ensureAccountInTx(
    tx: Tx,
    customerId: string,
    settings: StoreSettings,
  ): Promise<{ id: string; balance: number; customerId: string }> {
    const existing = await tx.loyaltyAccount.findUnique({ where: { customerId } });
    if (existing) return existing;

    const created = await tx.loyaltyAccount.create({
      data: { customerId, balance: 0 },
    });
    if (settings.loyaltyEnabled && settings.loyaltySignupBonusPoints > 0) {
      return this.applyLedger(tx, {
        accountId: created.id,
        type: LoyaltyLedgerType.SIGNUP_BONUS,
        points: settings.loyaltySignupBonusPoints,
        note: 'Welcome bonus',
      });
    }
    return created;
  }

  private async applyLedger(
    tx: Tx,
    input: {
      accountId: string;
      type: LoyaltyLedgerType;
      points: number;
      orderId?: string;
      note?: string;
    },
  ): Promise<{ id: string; balance: number; customerId: string }> {
    const account = await tx.loyaltyAccount.findUniqueOrThrow({
      where: { id: input.accountId },
    });
    const nextBalance = account.balance + input.points;
    if (nextBalance < 0) {
      throw new BadRequestException('Not enough loyalty points');
    }

    await tx.loyaltyLedgerEntry.create({
      data: {
        accountId: input.accountId,
        type: input.type,
        points: input.points,
        balanceAfter: nextBalance,
        orderId: input.orderId,
        note: input.note,
      },
    });

    return tx.loyaltyAccount.update({
      where: { id: input.accountId },
      data: { balance: nextBalance },
    });
  }

  private mapLedger(e: {
    id: string;
    type: LoyaltyLedgerType;
    points: number;
    balanceAfter: number;
    orderId: string | null;
    note: string | null;
    createdAt: Date;
  }): LoyaltyLedgerEntryDto {
    return {
      id: e.id,
      type: e.type as SharedLedgerType,
      points: e.points,
      balanceAfter: e.balanceAfter,
      orderId: e.orderId,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async requireRegisteredCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true, isGuest: true },
    });
    if (!customer || customer.isGuest) {
      throw new NotFoundException('Customer not found');
    }
    return customer.id;
  }
}
