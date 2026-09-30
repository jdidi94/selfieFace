import { OrderStatus, type StoreSettings } from '@prisma/client';
import type { Currency, OrderRefundPreviewDto } from '@lumea/types';

export type RefundPolicySettings = Pick<
  StoreSettings,
  | 'refundWindowDays'
  | 'refundWindowAfterShip'
  | 'refundAllowedAfterShipped'
  | 'refundAllowedAfterDelivered'
  | 'refundShippingRefundable'
  | 'refundTaxRefundable'
  | 'refundRestockingFeeBps'
  | 'refundDefaultPartialBps'
>;

export type RefundOrderSnapshot = {
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discount: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
  createdAt: Date;
};

export type RefundTimelineEvent = {
  status: OrderStatus;
  createdAt: Date;
};

const FULL_BPS = 10_000;

function findStatusAt(
  events: RefundTimelineEvent[],
  status: OrderStatus,
): Date | null {
  const hit = [...events].reverse().find((e) => e.status === status);
  return hit?.createdAt ?? null;
}

/**
 * Compute admin refund amount from market policy + order status.
 *
 * Pre-fulfillment (PENDING / PROCESSING): full order total (merchandise + shipping + tax).
 * Post-fulfillment (SHIPPED / DELIVERED returns):
 *   merchandise = (subtotal − discount) × partialBps
 *   shipping    = shippingAmount if refundShippingRefundable else 0
 *   tax         = proportional share of taxAmount if refundTaxRefundable else 0
 *   fee         = merchandise × restockingFeeBps
 *   amount      = clamp(merchandise + shipping + tax − fee, 0..total)
 */
export function computeOrderRefundPreview(
  order: RefundOrderSnapshot,
  policy: RefundPolicySettings,
  timeline: RefundTimelineEvent[] = [],
): OrderRefundPreviewDto {
  const currency = order.currency as Currency;
  const merchandiseNet = Math.max(0, order.subtotal - order.discount);
  const emptyBreakdown = {
    merchandise: 0,
    shipping: 0,
    tax: 0,
    restockingFee: 0,
    partialBps: FULL_BPS,
  };

  if (order.status === OrderStatus.CANCELLED) {
    return {
      eligible: false,
      reason: 'Order is cancelled',
      amount: 0,
      currency,
      preFulfillment: false,
      windowExpiresAt: null,
      breakdown: emptyBreakdown,
    };
  }

  const preFulfillment =
    order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING;

  if (preFulfillment) {
    return {
      eligible: true,
      reason: null,
      amount: order.total,
      currency,
      preFulfillment: true,
      windowExpiresAt: null,
      breakdown: {
        merchandise: merchandiseNet,
        shipping: order.shippingAmount,
        tax: order.taxAmount,
        restockingFee: 0,
        partialBps: FULL_BPS,
      },
    };
  }

  if (order.status === OrderStatus.SHIPPED && !policy.refundAllowedAfterShipped) {
    return {
      eligible: false,
      reason: 'Refunds are not allowed after the order has shipped',
      amount: 0,
      currency,
      preFulfillment: false,
      windowExpiresAt: null,
      breakdown: emptyBreakdown,
    };
  }

  if (order.status === OrderStatus.DELIVERED && !policy.refundAllowedAfterDelivered) {
    return {
      eligible: false,
      reason: 'Refunds are not allowed after the order has been delivered',
      amount: 0,
      currency,
      preFulfillment: false,
      windowExpiresAt: null,
      breakdown: emptyBreakdown,
    };
  }

  const shippedAt = findStatusAt(timeline, OrderStatus.SHIPPED);
  const deliveredAt = findStatusAt(timeline, OrderStatus.DELIVERED);
  const windowStart = policy.refundWindowAfterShip
    ? shippedAt ?? order.createdAt
    : deliveredAt ?? shippedAt ?? order.createdAt;

  let windowExpiresAt: string | null = null;
  if (policy.refundWindowDays > 0) {
    const expires = new Date(windowStart);
    expires.setUTCDate(expires.getUTCDate() + policy.refundWindowDays);
    windowExpiresAt = expires.toISOString();
    if (Date.now() > expires.getTime()) {
      return {
        eligible: false,
        reason: `Refund window of ${policy.refundWindowDays} day(s) has expired`,
        amount: 0,
        currency,
        preFulfillment: false,
        windowExpiresAt,
        breakdown: emptyBreakdown,
      };
    }
  }

  const partialBps =
    policy.refundDefaultPartialBps == null || policy.refundDefaultPartialBps <= 0
      ? FULL_BPS
      : Math.min(FULL_BPS, policy.refundDefaultPartialBps);

  const merchandise = Math.round((merchandiseNet * partialBps) / FULL_BPS);
  const shipping = policy.refundShippingRefundable ? order.shippingAmount : 0;

  const originalBeforeTax = merchandiseNet + order.shippingAmount;
  const refundableBeforeTax = merchandise + shipping;
  const tax =
    policy.refundTaxRefundable && originalBeforeTax > 0
      ? Math.round((order.taxAmount * refundableBeforeTax) / originalBeforeTax)
      : 0;

  const restockingFee = Math.round(
    (merchandise * Math.max(0, policy.refundRestockingFeeBps)) / FULL_BPS,
  );

  const amount = Math.max(
    0,
    Math.min(order.total, merchandise + shipping + tax - restockingFee),
  );

  return {
    eligible: amount > 0,
    reason: amount > 0 ? null : 'Computed refund amount is zero under current policy',
    amount,
    currency,
    preFulfillment: false,
    windowExpiresAt,
    breakdown: {
      merchandise,
      shipping,
      tax,
      restockingFee,
      partialBps,
    },
  };
}
