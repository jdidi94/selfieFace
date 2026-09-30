'use client';

import { LocaleLink } from '@/components/locale-link';
import { OrderStatusTimeline } from '@/components/order-status-timeline';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import {
  latestShippedNote,
  orderStatusLabel,
  paymentStatusLabel,
} from '@/lib/order-labels';
import { formatOrderMoney, orderCurrencyLabel } from '@/lib/order-money';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { PaymentStatus, type OrderDto } from '@lumea/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, accessToken, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    const data = await authFetch<OrderDto>(`/orders/${id}`, accessToken);
    setOrder(data);
    setLoading(false);
  }, [accessToken, id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/account/login');
      return;
    }
    if (!authLoading && accessToken) void load();
  }, [authLoading, user, accessToken, load, router]);

  async function cancelOrder() {
    if (!accessToken || !order) return;
    if (!window.confirm(t.cancelConfirm)) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await authFetch<OrderDto>(`/orders/${order.id}/cancel`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ note: 'Cancelled by customer' }),
      });
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.cancelFailed);
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading || loading) return <LoadingState label={t.loadingOrder} />;
  if (!user || !order) return null;

  const canCancel =
    order.canCancel ??
    ((order.status === 'PENDING' || order.status === 'PROCESSING') &&
      order.paymentStatus !== 'CAPTURED');

  const canRequestRefund = order.paymentStatus === PaymentStatus.CAPTURED;
  const isRefunded = order.paymentStatus === PaymentStatus.REFUNDED;
  const shippedNote = latestShippedNote(order.timeline);
  const refundHref = `/contact?topic=REFUND&orderNumber=${encodeURIComponent(order.number)}${
    order.customerEmail || user.email
      ? `&email=${encodeURIComponent(order.customerEmail || user.email)}`
      : ''
  }`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/account/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t.backToOrders}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{order.number}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{orderStatusLabel(order.status, t)}</Badge>
            <Badge variant="outline">{paymentStatusLabel(order.paymentStatus, t)}</Badge>
          </div>
        </div>
        <div className="max-w-xs space-y-2 text-end">
          {canCancel && (
            <details className="text-start">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                {t.cancelOrderDisclosure}
              </summary>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={cancelling}
                onClick={() => void cancelOrder()}
              >
                {cancelling ? t.cancelling : t.cancelOrder}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">{t.cancelPolicyHint}</p>
            </details>
          )}
          {canRequestRefund && !isRefunded ? (
            <div className="space-y-1">
              <Button variant="outline" asChild>
                <LocaleLink href={refundHref}>{t.requestReturnRefund}</LocaleLink>
              </Button>
              <p className="text-xs text-muted-foreground">
                {t.returnRefundNote}{' '}
                <LocaleLink href="/legal/returns" className="underline underline-offset-2">
                  {t.footerReturns}
                </LocaleLink>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {shippedNote ? (
        <p className="mt-4 rounded-md border border-border bg-surface-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">{t.trackingNoteLabel}: </span>
          {shippedNote}
        </p>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t.orderStatusTimeline}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTimeline
            status={order.status}
            timeline={order.timeline}
            createdAt={order.createdAt}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.items}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.product}</TableHead>
                <TableHead className="text-end">{t.qty}</TableHead>
                <TableHead className="text-end">{t.total}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.productName}
                    <span className="block text-xs text-muted-foreground">{item.variantName}</span>
                  </TableCell>
                  <TableCell className="text-end">{item.quantity}</TableCell>
                  <TableCell className="text-end">
                    {formatOrderMoney(item.lineTotal, order.currency, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {t.summary} ({orderCurrencyLabel(order.currency, locale)})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.subtotal}</span>
            <span>{formatOrderMoney(order.subtotal, order.currency, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.shipping}</span>
            <span>
              {order.shippingMethodName
                ? `${order.shippingMethodName} · `
                : ''}
              {formatOrderMoney(order.shippingAmount, order.currency, locale)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.tax}</span>
            <span>{formatOrderMoney(order.taxAmount, order.currency, locale)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-medium">
            <span>{t.total}</span>
            <span>{formatOrderMoney(order.total, order.currency, locale)}</span>
          </div>
          {order.paymentStatus === 'REFUNDED' && order.refundAmount != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t.refunded}</span>
              <span>{formatOrderMoney(order.refundAmount, order.currency, locale)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.shippingAddress}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="text-foreground">{order.shippingFullName}</p>
          <p>{order.shippingLine1}</p>
          {order.shippingLine2 && <p>{order.shippingLine2}</p>}
          <p>
            {order.shippingCity}
            {order.shippingRegion ? `, ${order.shippingRegion}` : ''} {order.shippingPostalCode}
          </p>
          <p>{order.shippingCountry}</p>
        </CardContent>
      </Card>
    </div>
  );
}
