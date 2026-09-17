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
  toast,
} from '@lumea/ui';
import type { StockNotifyListResponse } from '@lumea/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'notified', label: 'Marked notified' },
  { value: 'all', label: 'All' },
];

export default function StockNotifyPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<StockNotifyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50', status });
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<StockNotifyListResponse>(
      `/admin/stock-notify?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setLoading(false);
  }, [accessToken, status, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  async function markNotified(id: string) {
    if (!accessToken) return;
    try {
      await adminFetch(`/admin/stock-notify/${id}/notified`, accessToken, {
        method: 'PATCH',
      });
      toast('Marked as notified');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Back-in-stock alerts</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Customers who asked to be notified when a product returns. There is no outbound email
          provider yet — when inventory rises from zero, the API logs ready subscriptions; fulfill
          manually (or via your mail tool), then mark notified here.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
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
          placeholder="Search email, product, SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={() => setSearch(q)}>
          Search
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No subscriptions found.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <Link
                      href={`/catalog/products`}
                      className="hover:underline"
                      title={row.productSlug}
                    >
                      {row.productName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.variantName
                      ? `${row.variantName}${row.variantSku ? ` · ${row.variantSku}` : ''}`
                      : 'Any'}
                  </TableCell>
                  <TableCell>
                    {row.variantStock == null ? '—' : row.variantStock}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.notifiedAt ? 'secondary' : 'outline'}>
                      {row.notifiedAt ? 'Notified' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {!row.notifiedAt && (
                      <Button size="sm" variant="outline" onClick={() => void markNotified(row.id)}>
                        Mark notified
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {data.items.length} of {data.total}
        </p>
      )}
    </div>
  );
}
