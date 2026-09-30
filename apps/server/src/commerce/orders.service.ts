import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryReason,
  OrderStatus,
  OrderTimelineActorType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type {
  AdminOrderDto,
  MarketCode,
  OrderDto,
  OrderListResponse,
  OrderTimelineEventDto,
} from '@lumea/types';
import {
  guestOrderTrackSchema,
  orderAdminListQuerySchema,
  orderCancelSchema,
  orderLockSchema,
  orderRefundSchema,
  orderStatusUpdateSchema,
} from '@lumea/validation';
import Stripe from 'stripe';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';
import { OrderMailHelper } from '../mail/order-mail.helper';
import { PrismaService } from '../prisma/prisma.service';
import { restockFromAllocations } from '../inventory/warehouse-stock.util';
import { computeOrderRefundPreview } from './refund-policy.util';
import { StockNotifyService } from './stock-notify.service';
import { StoreSettingsService } from './store-settings.service';

type RestockNotify = {
  variantId: string;
  previousStock: number;
  nextStock: number;
};

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const orderItemInclude = {
  allocations: {
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

const orderItemsInclude = {
  items: { include: orderItemInclude },
} as const;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderItemsInclude }>;
type OrderWithTimeline = OrderWithItems & {
  timelineEvents: {
    id: string;
    status: OrderStatus;
    note: string | null;
    actorType: OrderTimelineActorType;
    createdAt: Date;
  }[];
};

@Injectable()
export class OrdersService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderMail: OrderMailHelper,
    private readonly stockNotify: StockNotifyService,
    private readonly loyaltyService: LoyaltyService,
    private readonly marketsService: MarketsService,
    private readonly settingsService: StoreSettingsService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) this.stripe = new Stripe(key);
  }

  assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === to) return;
    const allowed = STATUS_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot change order status from ${from} to ${to}`);
    }
  }

  async recordTimelineEvent(
    orderId: string,
    status: OrderStatus,
    actorType: OrderTimelineActorType,
    note?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.orderTimelineEvent.create({
      data: {
        orderId,
        status,
        actorType,
        note: note ?? null,
      },
    });
  }

  private canCustomerCancel(order: {
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    lockedAt?: Date | null;
  }): boolean {
    if (order.lockedAt) return false;
    const cancellableStatus =
      order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING;
    return (
      cancellableStatus &&
      order.paymentStatus !== PaymentStatus.CAPTURED &&
      order.paymentStatus !== PaymentStatus.REFUNDED
    );
  }

  private canAdminRefund(order: {
    paymentStatus: PaymentStatus;
    stripeRefundId?: string | null;
  }): boolean {
    return order.paymentStatus === PaymentStatus.CAPTURED && !order.stripeRefundId;
  }

    mapOrder(
    order: {
      id: string;
      number: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      currency: string;
      locale?: string;
      market?: { code: string } | null;
      subtotal: number;
      discount: number;
      shippingAmount: number;
      taxAmount: number;
      total: number;
      couponCode?: string | null;
      loyaltyPointsRedeemed?: number;
      loyaltyPointsEarned?: number;
      shippingZone: string;
      shippingMethodId?: string | null;
      shippingMethodCode?: string | null;
      shippingMethodName?: string | null;
      shippingFullName: string;
      shippingLine1: string;
      shippingLine2?: string | null;
      shippingCity: string;
      shippingRegion?: string | null;
      shippingPostalCode: string;
      shippingCountry: string;
      shippingPhone?: string | null;
      createdAt: Date;
      guestAccessToken?: string | null;
      stripeRefundId?: string | null;
      stripePaymentIntentId?: string | null;
      refundedAt?: Date | null;
      refundAmount?: number | null;
      paymentProvider?: string | null;
      konnectPaymentRef?: string | null;
      lockedAt?: Date | null;
      customer?: {
        email?: string | null;
        user?: { email?: string | null } | null;
      } | null;
      items: Array<{
        id: string;
        productName: string;
        variantName: string;
        sku: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
        allocations?: Array<{
          warehouseId: string;
          quantity: number;
          warehouse: { id: string; name: string; code: string };
        }>;
      }>;
    },
    opts?: {
      timeline?: OrderTimelineEventDto[];
      clientSecret?: string | null;
      guestAccessToken?: string | null;
      payUrl?: string | null;
    },
  ): OrderDto {
    const customerEmail =
      order.customer?.user?.email?.trim() ||
      order.customer?.email?.trim() ||
      null;
    return {
      id: order.id,
      number: order.number,
      status: order.status as OrderDto['status'],
      paymentStatus: order.paymentStatus as OrderDto['paymentStatus'],
      currency: order.currency as OrderDto['currency'],
      locale: order.locale as OrderDto['locale'],
      marketCode: order.market?.code
        ? parseMarketCode(order.market.code)
        : undefined,
      customerEmail,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      total: order.total,
      couponCode: order.couponCode ?? null,
      loyaltyPointsRedeemed: order.loyaltyPointsRedeemed ?? 0,
      loyaltyPointsEarned: order.loyaltyPointsEarned ?? 0,
      shippingZone: order.shippingZone as OrderDto['shippingZone'],
      shippingMethodId: order.shippingMethodId ?? null,
      shippingMethodCode: order.shippingMethodCode ?? null,
      shippingMethodName: order.shippingMethodName ?? null,
      shippingFullName: order.shippingFullName,
      shippingLine1: order.shippingLine1,
      shippingLine2: order.shippingLine2,
      shippingCity: order.shippingCity,
      shippingRegion: order.shippingRegion,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      shippingPhone: order.shippingPhone,
      items: order.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        allocations: i.allocations?.map((a) => ({
          warehouseId: a.warehouseId,
          warehouseCode: a.warehouse.code,
          warehouseName: a.warehouse.name,
          quantity: a.quantity,
        })),
      })),
      createdAt: order.createdAt.toISOString(),
      clientSecret: opts?.clientSecret ?? null,
      guestAccessToken: opts?.guestAccessToken ?? null,
      timeline: opts?.timeline,
      stripeRefundId: order.stripeRefundId ?? null,
      refundedAt: order.refundedAt?.toISOString() ?? null,
      refundAmount: order.refundAmount ?? null,
      canCancel: this.canCustomerCancel(order),
      canRefund: this.canAdminRefund(order),
      paymentProvider: order.paymentProvider ?? null,
      payUrl: opts?.payUrl ?? null,
      konnectPaymentRef: order.konnectPaymentRef ?? null,
      lockedAt: order.lockedAt?.toISOString() ?? null,
    };
  }

  private mapTimeline(
    events: OrderWithTimeline['timelineEvents'],
  ): OrderTimelineEventDto[] {
    return events.map((e) => ({
      id: e.id,
      status: e.status as OrderTimelineEventDto['status'],
      note: e.note,
      actorType: e.actorType as OrderTimelineEventDto['actorType'],
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async listAdmin(
    query: unknown,
    marketCode: MarketCode | string = 'OTHER',
  ): Promise<OrderListResponse> {
    const parsed = orderAdminListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const market = await this.marketsService.getByCode(marketCode);
    const { status, q, page, pageSize } = parsed.data;
    const where: Prisma.OrderWhereInput = { marketId: market.id };
    if (status) where.status = status as OrderStatus;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { number: { contains: term, mode: 'insensitive' } },
        {
          customer: {
            user: { email: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          customer: {
            phone: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          market: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status as OrderDto['status'],
        paymentStatus: o.paymentStatus as OrderDto['paymentStatus'],
        currency: o.currency as OrderDto['currency'],
        marketCode: parseMarketCode(o.market.code),
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        customerEmail:
          o.customer.user?.email ??
          (o.customer.phone ? `guest:${o.customer.phone}` : undefined),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getAdmin(id: string): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: orderItemInclude },
        timelineEvents: { orderBy: { createdAt: 'asc' } },
        customer: { include: { user: true } },
        market: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const timeline = this.mapTimeline(order.timelineEvents);
    const base = this.mapOrder(order, { timeline });
    const refundPreview = await this.buildRefundPreview(order, order.timelineEvents);

    return {
      ...base,
      canRefund: this.canAdminRefund(order) && refundPreview.eligible,
      refundPreview,
      customer: {
        email:
          order.customer.user?.email ??
          (order.customer.phone ? `guest:${order.customer.phone}` : 'guest'),
        firstName: order.customer.user?.firstName ?? null,
        lastName: order.customer.user?.lastName ?? null,
      },
    };
  }

  private async buildRefundPreview(
    order: {
      status: OrderStatus;
      currency: string;
      subtotal: number;
      discount: number;
      shippingAmount: number;
      taxAmount: number;
      total: number;
      createdAt: Date;
      market?: { code: string } | null;
      marketId?: string;
    },
    timeline: Array<{ status: OrderStatus; createdAt: Date }>,
  ) {
    const marketCode = order.market?.code
      ? parseMarketCode(order.market.code)
      : undefined;
    const settings = marketCode
      ? await this.settingsService.get(marketCode)
      : await this.settingsService.getByCurrency(order.currency);
    return computeOrderRefundPreview(order, settings, timeline);
  }

  private assertStatusUnlocked(order: { lockedAt?: Date | null; number?: string }) {
    if (order.lockedAt) {
      throw new BadRequestException(
        `Order${order.number ? ` ${order.number}` : ''} is locked. Unlock it before changing status.`,
      );
    }
  }

  async setLockAdmin(id: string, input: unknown): Promise<AdminOrderDto> {
    const parsed = orderLockSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const nextLockedAt = parsed.data.locked ? new Date() : null;
    if (Boolean(order.lockedAt) === parsed.data.locked) {
      return this.getAdmin(id);
    }

    await this.prisma.order.update({
      where: { id },
      data: { lockedAt: nextLockedAt },
    });
    return this.getAdmin(id);
  }

  async updateStatusAdmin(id: string, input: unknown): Promise<AdminOrderDto> {
    const parsed = orderStatusUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const next = parsed.data.status as OrderStatus;
    if (next === OrderStatus.CANCELLED) {
      return this.cancelOrderInternal(id, OrderTimelineActorType.ADMIN, parsed.data.note);
    }

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: orderItemsInclude,
      });
      this.assertStatusUnlocked(order);
      if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException('Order cannot be updated');
      }
      this.assertTransition(order.status, next);
      await tx.order.update({
        where: { id },
        data: {
          status: next,
          ...(next === OrderStatus.DELIVERED ? { guestAccessToken: null } : {}),
        },
      });
      await this.recordTimelineEvent(
        id,
        next,
        OrderTimelineActorType.ADMIN,
        parsed.data.note,
        tx,
      );
    });

    await this.orderMail.sendStatusChange(id, next, parsed.data.note);
    return this.getAdmin(id);
  }

  async cancelByCustomer(userId: string, orderId: string, input: unknown): Promise<OrderDto> {
    const parsed = orderCancelSchema.safeParse(input ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException();

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customer.id) {
      throw new NotFoundException('Order not found');
    }
    if (!this.canCustomerCancel(order)) {
      throw new BadRequestException(
        'Only pending or processing unpaid / cash-on-delivery orders can be cancelled. Contact support for paid orders.',
      );
    }

    await this.cancelOrderInternal(
      orderId,
      OrderTimelineActorType.CUSTOMER,
      parsed.data.note ?? 'Cancelled by customer',
    );
    return this.getCustomerOrder(userId, orderId);
  }

  async cancelByAdmin(id: string, input: unknown): Promise<AdminOrderDto> {
    const parsed = orderCancelSchema.safeParse(input ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.cancelOrderInternal(
      id,
      OrderTimelineActorType.ADMIN,
      parsed.data.note ?? 'Cancelled by admin',
    );
  }

  async refundByAdmin(id: string, input: unknown): Promise<AdminOrderDto> {
    const parsed = orderRefundSchema.safeParse(input ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        ...orderItemsInclude,
        timelineEvents: { orderBy: { createdAt: 'asc' } },
        market: true,
      },
    });

    if (order.paymentStatus === PaymentStatus.REFUNDED || order.stripeRefundId) {
      throw new BadRequestException('Order is already refunded');
    }
    if (order.paymentStatus !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured card payments can be refunded');
    }

    const preview = await this.buildRefundPreview(order, order.timelineEvents);
    if (!preview.eligible) {
      throw new BadRequestException(preview.reason ?? 'Refund is not allowed by policy');
    }

    let refundAmount = preview.amount;
    if (parsed.data.amount != null) {
      if (parsed.data.amount > order.total) {
        throw new BadRequestException('Refund amount cannot exceed order total');
      }
      refundAmount = parsed.data.amount;
    }
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const refund = await this.stripeRefundOrder(order, refundAmount);
    const shouldCancel =
      parsed.data.cancelOrder !== false &&
      (order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING);

    let restocks: RestockNotify[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findUniqueOrThrow({
          where: { id },
          include: orderItemsInclude,
        });
        if (current.paymentStatus === PaymentStatus.REFUNDED) return;

        restocks = await this.restockOrderItems(current, tx);
        await this.releaseCouponRedemption(current.id, tx);

        await tx.order.update({
          where: { id },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            refundAmount: refund.amount,
            stripeRefundId: refund.id,
            ...(shouldCancel ? { status: OrderStatus.CANCELLED } : {}),
          },
        });

        await this.recordTimelineEvent(
          id,
          shouldCancel ? OrderStatus.CANCELLED : current.status,
          OrderTimelineActorType.ADMIN,
          parsed.data.note ??
            (shouldCancel
              ? `Refunded ${refund.amount} and cancelled`
              : `Refunded ${refund.amount}`),
          tx,
        );
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    await this.notifyStockAvailable(restocks);

    await this.loyaltyService.reverseForOrder(id);

    await this.orderMail.sendStatusChange(
      id,
      shouldCancel ? OrderStatus.CANCELLED : order.status,
      parsed.data.note ??
        (shouldCancel
          ? `Refunded ${refund.amount} and cancelled`
          : `Refunded ${refund.amount}`),
    );

    return this.getAdmin(id);
  }

  private async cancelOrderInternal(
    id: string,
    actor: OrderTimelineActorType,
    note?: string | null,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: orderItemsInclude,
    });

    this.assertStatusUnlocked(order);

    if (order.status === OrderStatus.CANCELLED) {
      return this.getAdmin(id);
    }
    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot cancel shipped or delivered orders. Issue a refund instead for returns.',
      );
    }
    if (
      actor === OrderTimelineActorType.CUSTOMER &&
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PROCESSING
    ) {
      throw new BadRequestException('Only pending or processing orders can be cancelled');
    }

    this.assertTransition(order.status, OrderStatus.CANCELLED);

    let refundId: string | null = null;
    let refundAmount: number | null = null;
    let nextPaymentStatus = order.paymentStatus;

    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      if (actor === OrderTimelineActorType.CUSTOMER) {
        throw new BadRequestException('Paid orders cannot be cancelled by customer');
      }
      const refund = await this.stripeRefundOrder(order, order.total);
      refundId = refund.id;
      refundAmount = refund.amount;
      nextPaymentStatus = PaymentStatus.REFUNDED;
    } else if (order.paymentStatus === PaymentStatus.AUTHORIZED) {
      nextPaymentStatus = PaymentStatus.UNPAID;
    } else if (order.paymentStatus === PaymentStatus.UNPAID && order.stripePaymentIntentId) {
      await this.stripeCancelPaymentIntent(order.stripePaymentIntentId);
    }

    let restocks: RestockNotify[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findUniqueOrThrow({
          where: { id },
          include: orderItemsInclude,
        });
        if (current.status === OrderStatus.CANCELLED) return;

        if (
          current.paymentStatus === PaymentStatus.CAPTURED ||
          current.paymentStatus === PaymentStatus.AUTHORIZED
        ) {
          restocks = await this.restockOrderItems(current, tx);
        }
        await this.releaseCouponRedemption(current.id, tx);

        await tx.order.update({
          where: { id },
          data: {
            status: OrderStatus.CANCELLED,
            paymentStatus: nextPaymentStatus,
            guestAccessToken: null,
            ...(refundId
              ? {
                  stripeRefundId: refundId,
                  refundedAt: new Date(),
                  refundAmount,
                }
              : {}),
          },
        });
        await this.recordTimelineEvent(
          id,
          OrderStatus.CANCELLED,
          actor,
          note ??
            (refundId
              ? 'Order cancelled and payment refunded'
              : 'Order cancelled'),
          tx,
        );
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    await this.notifyStockAvailable(restocks);

    await this.loyaltyService.reverseForOrder(id);

    await this.orderMail.sendStatusChange(
      id,
      OrderStatus.CANCELLED,
      note ??
        (refundId
          ? 'Order cancelled and payment refunded'
          : 'Order cancelled'),
    );

    return this.getAdmin(id);
  }

  private async stripeRefundOrder(
    order: OrderWithItems,
    amount?: number,
  ): Promise<{ id: string; amount: number }> {
    const refundAmount = Math.max(
      0,
      Math.min(order.total, amount ?? order.total),
    );
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (order.stripeRefundId) {
      return { id: order.stripeRefundId, amount: order.refundAmount ?? refundAmount };
    }

    if (!order.stripePaymentIntentId) {
      return { id: `manual_${order.id}`, amount: refundAmount };
    }

    if (!this.stripe) {
      return { id: `dev_refund_${order.id}`, amount: refundAmount };
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          orderId: order.id,
          orderNumber: order.number,
        },
      });
      return { id: refund.id, amount: refund.amount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe refund failed';
      throw new BadRequestException(message);
    }
  }

  private async stripeCancelPaymentIntent(paymentIntentId: string): Promise<void> {
    if (!this.stripe) return;
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (
        intent.status === 'requires_payment_method' ||
        intent.status === 'requires_confirmation' ||
        intent.status === 'requires_action'
      ) {
        await this.stripe.paymentIntents.cancel(paymentIntentId);
      }
    } catch {
      // Best-effort: order cancel should still proceed
    }
  }

  private async releaseCouponRedemption(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.couponRedemption.deleteMany({ where: { orderId } });
  }

  private async restockOrderItems(
    order: OrderWithItems,
    tx: Prisma.TransactionClient,
  ): Promise<RestockNotify[]> {
    const restocks: RestockNotify[] = [];
    for (const item of order.items) {
      const existing = await tx.inventoryMovement.findFirst({
        where: {
          variantId: item.variantId,
          note: { contains: order.number },
          reason: InventoryReason.RESTOCK,
        },
      });
      if (existing) continue;

      const allocations = item.allocations.map((a) => ({
        warehouseId: a.warehouseId,
        quantity: a.quantity,
      }));

      const { previousAggregate, nextAggregate } = await restockFromAllocations(tx, {
        variantId: item.variantId,
        quantity: item.quantity,
        note: `Restock ${order.number}`,
        allocations,
      });
      restocks.push({
        variantId: item.variantId,
        previousStock: previousAggregate,
        nextStock: nextAggregate,
      });
    }
    return restocks;
  }

  private async notifyStockAvailable(restocks: RestockNotify[]): Promise<void> {
    for (const restock of restocks) {
      await this.stockNotify.onStockAvailable(
        restock.variantId,
        restock.previousStock,
        restock.nextStock,
      );
    }
  }

  async trackGuestOrder(input: unknown): Promise<OrderDto> {
    const parsed = guestOrderTrackSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const order = await this.prisma.order.findUnique({
      where: { number: parsed.data.orderNumber },
      include: {
        items: { include: orderItemInclude },
        timelineEvents: { orderBy: { createdAt: 'asc' } },
        customer: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });
    if (
      !order?.guestAccessToken ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new NotFoundException('Order not found');
    }

    const { email, token } = parsed.data;
    let authorized = false;
    if (token) {
      authorized = order.guestAccessToken === token;
    } else if (email) {
      const orderEmail =
        order.customer.user?.email?.trim().toLowerCase() ||
        order.customer.email?.trim().toLowerCase() ||
        null;
      authorized = Boolean(orderEmail && orderEmail === email);
    }
    if (!authorized) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrder(order, {
      timeline: this.mapTimeline(order.timelineEvents),
      guestAccessToken: order.guestAccessToken,
    });
  }

  async cancelByGuest(
    orderId: string,
    guestAccessToken: string | null | undefined,
    input: unknown,
  ): Promise<OrderDto> {
    const parsed = orderCancelSchema.safeParse(input ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (!guestAccessToken) throw new ForbiddenException('Order access denied');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (
      !order ||
      !order.guestAccessToken ||
      order.guestAccessToken !== guestAccessToken
    ) {
      throw new NotFoundException('Order not found');
    }
    if (!this.canCustomerCancel(order)) {
      throw new BadRequestException(
        'Only pending or processing unpaid / cash-on-delivery orders can be cancelled. Contact support for paid orders.',
      );
    }

    return this.cancelOrderInternal(
      orderId,
      OrderTimelineActorType.CUSTOMER,
      parsed.data.note ?? 'Cancelled by guest',
    );
  }

  async getCustomerOrder(userId: string, orderId: string): Promise<OrderDto> {
    return this.getOrderForAccess(orderId, { userId });
  }

  async getOrderForAccess(
    orderId: string,
    opts: { userId?: string | null; guestAccessToken?: string | null },
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: orderItemInclude },
        timelineEvents: { orderBy: { createdAt: 'asc' } },
        customer: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (opts.userId) {
      const customer = await this.prisma.customer.findUnique({ where: { userId: opts.userId } });
      if (!customer || order.customerId !== customer.id) {
        throw new NotFoundException('Order not found');
      }
    } else if (
      opts.guestAccessToken &&
      order.guestAccessToken &&
      opts.guestAccessToken === order.guestAccessToken &&
      order.status !== OrderStatus.CANCELLED &&
      order.status !== OrderStatus.DELIVERED
    ) {
      // guest OK
    } else {
      throw new ForbiddenException('Order access denied');
    }

    return this.mapOrder(order, {
      timeline: this.mapTimeline(order.timelineEvents),
      guestAccessToken: opts.guestAccessToken ? order.guestAccessToken : null,
    });
  }

  async listCustomerOrders(userId: string): Promise<OrderDto[]> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException();

    const rows = await this.prisma.order.findMany({
      where: { customerId: customer.id },
      include: {
        ...orderItemsInclude,
        customer: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((o) => this.mapOrder(o));
  }
}
