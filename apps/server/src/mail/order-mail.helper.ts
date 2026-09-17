import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { OrderMailContext } from './mail.types';
import { SesMailService } from './ses-mail.service';

@Injectable()
export class OrderMailHelper {
  private readonly logger = new Logger(OrderMailHelper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: SesMailService,
  ) {}

  async loadContext(
    orderId: string,
    opts?: { trackingNote?: string | null },
  ): Promise<OrderMailContext | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: {
          include: {
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!order) return null;

    const email =
      order.customer.user?.email?.trim().toLowerCase() ||
      order.customer.email?.trim().toLowerCase() ||
      null;
    if (!email) {
      this.logger.log(
        `[mail] skip order=${order.number} — no customer email (guest/phone-only)`,
      );
      return null;
    }

    const nameParts = [
      order.customer.user?.firstName,
      order.customer.user?.lastName,
    ].filter(Boolean);
    const customerName =
      nameParts.join(' ').trim() || order.shippingFullName || 'there';

    const storefrontUrl = this.mail.getStorefrontUrl();
    const isGuest = order.customer.isGuest || !order.customer.userId;
    const orderUrl =
      isGuest && order.guestAccessToken
        ? `${storefrontUrl}/orders/track?number=${encodeURIComponent(order.number)}&token=${encodeURIComponent(order.guestAccessToken)}`
        : `${storefrontUrl}/account/orders/${order.id}`;

    return {
      orderId: order.id,
      userId: order.customer.userId,
      orderNumber: order.number,
      customerName,
      email,
      currency: order.currency,
      total: order.total,
      status: order.status,
      locale: order.locale,
      items: order.items.map((item) => ({
        name: `${item.productName} — ${item.variantName}`,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      trackingNote: opts?.trackingNote ?? null,
      storefrontUrl,
      orderUrl,
    };
  }

  async sendConfirmation(orderId: string): Promise<void> {
    const ctx = await this.loadContext(orderId);
    if (!ctx) return;
    const result = await this.mail.sendOrderConfirmation(ctx);
    this.logger.log(
      `[mail] order-confirmation ${ctx.orderNumber} sent=${result.sent} ${result.skippedReason ?? result.messageId ?? ''}`,
    );
    await this.mail.notifyAdminNewOrder(ctx);
  }

  async sendStatusChange(
    orderId: string,
    status: OrderStatus,
    note?: string | null,
  ): Promise<void> {
    const ctx = await this.loadContext(orderId, { trackingNote: note });
    if (!ctx) return;

    let result;
    if (status === OrderStatus.SHIPPED) {
      result = await this.mail.sendOrderShipped(ctx);
    } else if (status === OrderStatus.DELIVERED) {
      result = await this.mail.sendOrderDelivered(ctx);
    } else if (status === OrderStatus.CANCELLED) {
      result = await this.mail.sendOrderCancelled(ctx);
    } else {
      return;
    }

    this.logger.log(
      `[mail] order-${status.toLowerCase()} ${ctx.orderNumber} sent=${result.sent} ${result.skippedReason ?? result.messageId ?? ''}`,
    );
  }
}
