'use client';

import { OrderStatusTimeline } from '@/components/order-status-timeline';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
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
import type { OrderDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/account/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t.backToOrders}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{order.number}</h1>
          <div className="mt-2 flex gap-2">
            <Badge>{order.status}</Badge>
            <Badge variant="outline">{order.paymentStatus}</Badge>
          </div>
        </div>
        {canCancel && (
          <div className="max-w-xs space-y-2 text-end">
            <Button variant="destructive" disabled={cancelling} onClick={() => void cancelOrder()}>
              {cancelling ? t.cancelling : t.cancelOrder}
            </Button>
            <p className="text-xs text-muted-foreground">{t.cancelPolicyHint}</p>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

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
                    {formatMoney(item.lineTotal, order.currency)}
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
            {t.summary} ({order.currency})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.subtotal}</span>
            <span>{formatMoney(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.shipping}</span>
            <span>
              {order.shippingMethodName
                ? `${order.shippingMethodName} · `
                : ''}
              {formatMoney(order.shippingAmount, order.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.tax}</span>
            <span>{formatMoney(order.taxAmount, order.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-medium">
            <span>{t.total}</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
          {order.paymentStatus === 'REFUNDED' && order.refundAmount != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t.refunded}</span>
              <span>{formatMoney(order.refundAmount, order.currency)}</span>
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
