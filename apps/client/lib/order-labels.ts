import type { StorefrontMessages } from '@/lib/messages';
import {
  OrderStatus,
  PaymentStatus,
  SupportTicketStatus,
} from '@lumea/types';

export function orderStatusLabel(
  status: OrderStatus | string,
  t: StorefrontMessages,
): string {
  switch (status) {
    case OrderStatus.PENDING:
    case 'PENDING':
      return t.orderStatusPending;
    case OrderStatus.PROCESSING:
    case 'PROCESSING':
      return t.orderStatusProcessing;
    case OrderStatus.SHIPPED:
    case 'SHIPPED':
      return t.orderStatusShipped;
    case OrderStatus.DELIVERED:
    case 'DELIVERED':
      return t.orderStatusDelivered;
    case OrderStatus.CANCELLED:
    case 'CANCELLED':
      return t.orderStatusCancelled;
    default:
      return String(status);
  }
}

export function paymentStatusLabel(
  status: PaymentStatus | string,
  t: StorefrontMessages,
): string {
  switch (status) {
    case PaymentStatus.UNPAID:
    case 'UNPAID':
      return t.paymentStatusUnpaid;
    case PaymentStatus.AUTHORIZED:
    case 'AUTHORIZED':
      return t.paymentStatusAuthorized;
    case PaymentStatus.CAPTURED:
    case 'CAPTURED':
      return t.paymentStatusCaptured;
    case PaymentStatus.REFUNDED:
    case 'REFUNDED':
      return t.paymentStatusRefunded;
    case PaymentStatus.FAILED:
    case 'FAILED':
      return t.paymentStatusFailed;
    default:
      return String(status);
  }
}

export function supportTicketStatusLabel(
  status: SupportTicketStatus | string,
  t: StorefrontMessages,
): string {
  switch (status) {
    case SupportTicketStatus.OPEN:
    case 'OPEN':
      return t.contactTicketStatusOpen;
    case SupportTicketStatus.IN_PROGRESS:
    case 'IN_PROGRESS':
      return t.contactTicketStatusInProgress;
    case SupportTicketStatus.CLOSED:
    case 'CLOSED':
      return t.contactTicketStatusClosed;
    case 'RESOLVED':
      return t.contactTicketStatusResolved;
    default:
      return String(status);
  }
}

/** Latest SHIPPED timeline note, if any. */
export function latestShippedNote(
  timeline?: { status: string; note?: string | null; createdAt: string }[] | null,
): string | null {
  if (!timeline?.length) return null;
  const shipped = [...timeline]
    .filter((e) => e.status === 'SHIPPED' && e.note?.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return shipped[0]?.note?.trim() ?? null;
}
