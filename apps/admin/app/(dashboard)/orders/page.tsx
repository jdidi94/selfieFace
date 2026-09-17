'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
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

export default function OrdersPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

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
    setLoading(false);
  }, [accessToken, status, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

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

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={order.id}>
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
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
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
