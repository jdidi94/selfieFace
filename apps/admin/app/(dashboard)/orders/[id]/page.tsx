'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { orderCancelSchema, orderRefundSchema, orderStatusUpdateSchema } from '@lumea/validation';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { OrderStatus, PaymentStatus, type AdminOrderDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<AdminOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextStatus, setNextStatus] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    const data = await adminFetch<AdminOrderDto>(`/admin/orders/${id}`, accessToken);
    setOrder(data);
    setLoading(false);
  }, [accessToken, id]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  async function applyStatus() {
    if (!accessToken) {
      setError('You must be signed in to update orders');
      return;
    }
    if (!order) {
      setError('Order not loaded');
      return;
    }
    if (!nextStatus) {
      setError('Choose a status to apply');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isCancel = nextStatus === OrderStatus.CANCELLED;
      const path = isCancel
        ? `/admin/orders/${order.id}/cancel`
        : `/admin/orders/${order.id}/status`;
      const raw = isCancel
        ? { note: note.trim() || null }
        : { status: nextStatus, note: note.trim() || null };
      const schema = isCancel ? orderCancelSchema : orderStatusUpdateSchema;
      const validated = validateWithSchema(schema, raw);
      if (!validated.ok) {
        setError(validated.message);
        setSaving(false);
        return;
      }
      const updated = await adminFetch<AdminOrderDto>(path, accessToken, {
        method: isCancel ? 'POST' : 'PATCH',
        body: JSON.stringify(validated.data),
      });
      setOrder(updated);
      setNextStatus('');
      setNote('');
    } catch (e) {
      setError(submitErrorState(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function refundOrder() {
    if (!accessToken || !order) return;
    const confirmed = window.confirm(
      order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING
        ? 'Refund this payment via Stripe and cancel the order? Stock will be restored.'
        : 'Refund this payment via Stripe and restore stock? Order status stays as-is (use for returns).',
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        note: note.trim() || null,
        cancelOrder:
          order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING,
      };
      const validated = validateWithSchema(orderRefundSchema, payload);
      if (!validated.ok) {
        setError(validated.message);
        setSaving(false);
        return;
      }
      const updated = await adminFetch<AdminOrderDto>(
        `/admin/orders/${order.id}/refund`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(validated.data),
        },
      );
      setOrder(updated);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;
  if (!order) return <p className="text-muted-foreground">Order not found.</p>;

  const options = NEXT_STATUSES[order.status] ?? [];
  const canRefund = order.canRefund ?? order.paymentStatus === PaymentStatus.CAPTURED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">
            ← Orders
          </Link>
          <h1 className="font-display mt-2 text-3xl">{order.number}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{order.status}</Badge>
            <Badge variant="outline">{order.paymentStatus}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {options.length > 0 && (
            <>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!nextStatus || saving} onClick={() => void applyStatus()}>
                {saving ? 'Saving…' : 'Apply'}
              </Button>
            </>
          )}
          {canRefund && (
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void refundOrder()}
            >
              {saving ? 'Working…' : 'Refund payment'}
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-md space-y-2">
        <Label htmlFor="order-note">Note (cancel / refund / status)</Label>
        <Input
          id="order-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional reason for timeline"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(order.refundedAt || order.refundAmount != null) && (
        <Card>
          <CardHeader>
            <CardTitle>Refund</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.refundedAt && (
              <p>Refunded at {new Date(order.refundedAt).toLocaleString()}</p>
            )}
            {order.refundAmount != null && (
              <p>Amount: {formatMoney(order.refundAmount, order.currency)}</p>
            )}
            {order.stripeRefundId && (
              <p className="text-muted-foreground">Refund ID: {order.stripeRefundId}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{order.customer.email}</p>
            {(order.customer.firstName || order.customer.lastName) && (
              <p className="text-muted-foreground">
                {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping</CardTitle>
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
            {order.shippingPhone && <p>{order.shippingPhone}</p>}
            {(order.shippingMethodName || order.shippingMethodCode) && (
              <p className="mt-2 text-foreground">
                Method: {order.shippingMethodName ?? order.shippingMethodCode}
                {order.shippingMethodCode ? ` (${order.shippingMethodCode})` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Fulfilled from</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Line</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p>{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.variantName}</p>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.allocations?.length
                      ? item.allocations
                          .map((a) => `${a.warehouseName} (${a.quantity})`)
                          .join(', ')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(item.unitPrice, order.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(item.lineTotal, order.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals ({order.currency})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatMoney(order.shippingAmount, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatMoney(order.taxAmount, order.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-medium">
            <span>Total</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {(order.timeline ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="space-y-4 border-l border-border pl-4">
              {(order.timeline ?? []).map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{ev.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleString()} · {ev.actorType}
                  </p>
                  {ev.note && <p className="text-sm text-muted-foreground">{ev.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
