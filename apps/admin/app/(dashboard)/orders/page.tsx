'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Input,
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
import type { OrderListResponse, OrderStatus } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function statusVariant(status: OrderStatus): 'default' | 'secondary' | 'outline' | 'accent' {
  if (status === 'CANCELLED') return 'accent';
  if (status === 'DELIVERED') return 'secondary';
  if (status === 'SHIPPED' || status === 'PROCESSING') return 'default';
  return 'outline';
}

const statusStyles: Record<OrderStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-900',
  PROCESSING: 'border-sky-300 bg-sky-50 text-sky-900',
  SHIPPED: 'border-violet-300 bg-violet-50 text-violet-900',
  DELIVERED: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  CANCELLED: 'border-slate-300 bg-slate-100 text-slate-700',
};

const statusRowStyles: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50/30',
  PROCESSING: 'bg-sky-50/30',
  SHIPPED: 'bg-violet-50/30',
  DELIVERED: 'bg-emerald-50/30',
  CANCELLED: 'bg-slate-50/50',
};

export default function OrdersPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<OrderListResponse>(
      `/admin/orders?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setSelectedIds([]);
    setLoading(false);
  }, [accessToken, status, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  const pendingIds = (data?.items ?? [])
    .filter((order) => order.status === 'PENDING')
    .map((order) => order.id);
  const selectedPendingIds = selectedIds.filter((id) => pendingIds.includes(id));

  async function startSelectedOrders() {
    if (!accessToken || selectedPendingIds.length === 0) return;
    if (!window.confirm(`Move ${selectedPendingIds.length} pending order(s) to processing?`)) return;
    setBulkPending(true);
    setActionMessage(null);
    const results = await Promise.allSettled(
      selectedPendingIds.map((id) =>
        adminFetch(`/admin/orders/${id}/status`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PROCESSING' }),
        }),
      ),
    );
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    setSelectedIds([]);
    setActionMessage(
      failed
        ? `${succeeded} updated; ${failed} could not be changed (for example, locked orders).`
        : `${succeeded} orders moved to processing.`,
    );
    setBulkPending(false);
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Orders</h1>
        <p className="text-sm text-muted-foreground">Fulfillment queue and order history.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Order # or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(q);
          }}
        />
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
          onClick={() => setSearch(q)}
        >
          Search
        </button>
      </div>

      {actionMessage ? <p role="status" className="text-sm text-muted-foreground">{actionMessage}</p> : null}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/50 p-3">
          <p className="text-sm">{selectedIds.length} selected · {selectedPendingIds.length} pending can move to processing</p>
          <Button size="sm" disabled={bulkPending || selectedPendingIds.length === 0} onClick={() => void startSelectedOrders()}>
            {bulkPending ? 'Updating…' : 'Start processing'}
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select pending orders on this page"
                  checked={pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id))}
                  onChange={(event) => setSelectedIds(event.target.checked ? pendingIds : [])}
                />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((order) => (
              <TableRow key={order.id} className={statusRowStyles[order.status]}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select order ${order.number}`}
                    disabled={order.status !== 'PENDING'}
                    checked={selectedIds.includes(order.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, order.id]
                          : current.filter((id) => id !== order.id),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {order.number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{order.customerEmail}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(order.status)} className={statusStyles[order.status]}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{order.paymentStatus}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(order.total, order.currency)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No orders found.</p>
        )}
      </div>
    </div>
  );
}
