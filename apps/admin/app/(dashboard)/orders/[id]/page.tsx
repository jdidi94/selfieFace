'use client';

import { ConfirmTypedDialog } from '@/components/confirm-typed-dialog';
import { FormErrorBanner } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import {
  orderCancelSchema,
  orderLockSchema,
  orderRefundSchema,
  orderStatusUpdateSchema,
} from '@lumea/validation';
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
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmountOverride, setRefundAmountOverride] = useState('');

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

  async function toggleLock() {
    if (!accessToken || !order) return;
    const locked = !order.lockedAt;
    setSaving(true);
    setError(null);
    try {
      const validated = validateWithSchema(orderLockSchema, { locked });
      if (!validated.ok) {
        setError(validated.message);
        setSaving(false);
        return;
      }
      const updated = await adminFetch<AdminOrderDto>(
        `/admin/orders/${order.id}/lock`,
        accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        },
      );
      setOrder(updated);
      setLockDialogOpen(false);
    } catch (e) {
      setError(submitErrorState(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function refundOrder() {
    if (!accessToken || !order) return;
    const preview = order.refundPreview;
    const suggested = preview?.amount ?? order.total;
    const overrideRaw = refundAmountOverride.trim();
    const amount = overrideRaw ? Number(overrideRaw) : suggested;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Refund amount must be a positive number (minor units)');
      return;
    }
    if (amount > order.total) {
      setError('Refund amount cannot exceed order total');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: {
        note: string | null;
        cancelOrder: boolean;
        amount?: number;
      } = {
        note: note.trim() || null,
        cancelOrder:
          order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING,
      };
      if (overrideRaw) {
        payload.amount = Math.round(amount);
      }
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
      setRefundAmountOverride('');
      setRefundDialogOpen(false);
    } catch (e) {
      setError(submitErrorState(e).message);
    } finally {
      setSaving(false);
    }
  }

  function openRefundDialog() {
    setRefundAmountOverride('');
    setError(null);
    setRefundDialogOpen(true);
  }

  if (authLoading || loading) return <LoadingState />;
  if (!order) return <p className="text-muted-foreground">Order not found.</p>;

  const options = NEXT_STATUSES[order.status] ?? [];
  const preview = order.refundPreview;
  const canRefund =
    order.canRefund ??
    (order.paymentStatus === PaymentStatus.CAPTURED && !order.stripeRefundId);
  const isLocked = Boolean(order.lockedAt);
  const suggestedRefund = preview?.amount ?? order.total;

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
            {isLocked && <Badge variant="accent">Status locked</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {options.length > 0 && (
            <>
              <Select
                value={nextStatus}
                onValueChange={setNextStatus}
                disabled={isLocked}
              >
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
              <Button
                disabled={!nextStatus || saving || isLocked}
                onClick={() => void applyStatus()}
              >
                {saving ? 'Saving…' : 'Apply'}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setLockDialogOpen(true)}
          >
            {isLocked ? 'Unlock status' : 'Lock status'}
          </Button>
          {canRefund && (
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => openRefundDialog()}
            >
              Refund payment
            </Button>
          )}
        </div>
      </div>

      {isLocked && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Status changes are disabled while locked
          {order.lockedAt ? ` (since ${new Date(order.lockedAt).toLocaleString()})` : ''}.
          Unlock to update or cancel.
        </p>
      )}

      <div className="max-w-md space-y-2">
        <Label htmlFor="order-note">Note (cancel / refund / status)</Label>
        <Input
          id="order-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional reason for timeline"
        />
      </div>

      {error && <FormErrorBanner message={error} />}

      <ConfirmTypedDialog
        open={lockDialogOpen}
        title={isLocked ? 'Unlock order status' : 'Lock order status'}
        description={
          isLocked
            ? 'Unlocking allows status updates and cancellations again.'
            : 'While locked, status updates and cancellations are rejected until unlocked.'
        }
        confirmLabel={isLocked ? 'UNLOCK' : 'LOCK'}
        confirmValue={isLocked ? 'UNLOCK' : 'LOCK'}
        confirmButtonLabel={isLocked ? 'Unlock' : 'Lock'}
        destructive={!isLocked}
        onCancel={() => setLockDialogOpen(false)}
        onConfirm={() => toggleLock()}
      />

      {refundDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-surface p-5 shadow-lg">
            <div>
              <h2 className="font-display text-xl">Confirm refund</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {preview?.preFulfillment !== false &&
                (order.status === OrderStatus.PENDING ||
                  order.status === OrderStatus.PROCESSING)
                  ? 'Pre-fulfillment: full payment will be refunded and the order cancelled.'
                  : 'Return refund based on this market’s policy. Order status stays as-is; stock is restored.'}
              </p>
            </div>
            <div className="space-y-1 rounded-md border border-border bg-surface-muted/40 p-3 text-sm">
              {preview ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Merchandise</span>
                    <span>
                      {formatMoney(preview.breakdown.merchandise, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {formatMoney(preview.breakdown.shipping, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatMoney(preview.breakdown.tax, order.currency)}</span>
                  </div>
                  {preview.breakdown.restockingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Restocking fee</span>
                      <span>
                        −{formatMoney(preview.breakdown.restockingFee, order.currency)}
                      </span>
                    </div>
                  )}
                </>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <span>Suggested refund</span>
                <span>{formatMoney(suggestedRefund, order.currency)}</span>
              </div>
              {preview?.windowExpiresAt && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Window expires {new Date(preview.windowExpiresAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-amount-override">
                Override amount (minor units, blank = suggested)
              </Label>
              <Input
                id="refund-amount-override"
                value={refundAmountOverride}
                onChange={(e) => setRefundAmountOverride(e.target.value)}
                placeholder={String(suggestedRefund)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setRefundDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void refundOrder()}
              >
                {saving ? 'Working…' : 'Confirm refund'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {preview && order.paymentStatus === PaymentStatus.CAPTURED && !order.stripeRefundId && (
        <Card>
          <CardHeader>
            <CardTitle>Refund preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {preview.eligible ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suggested</span>
                  <span className="font-medium">
                    {formatMoney(preview.amount, order.currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {preview.preFulfillment
                    ? 'Full order total (pending/processing).'
                    : `Merchandise ${(preview.breakdown.partialBps / 100).toFixed(0)}%` +
                      (preview.breakdown.shipping > 0 ? ' + shipping' : '') +
                      (preview.breakdown.tax > 0 ? ' + tax' : '') +
                      (preview.breakdown.restockingFee > 0 ? ' − restocking fee' : '') +
                      '.'}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {preview.reason ?? 'Refund not allowed under current policy.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
