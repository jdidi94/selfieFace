'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Input,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import type { AdminCustomerListResponse } from '@lumea/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function CustomersPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminCustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<AdminCustomerListResponse>(
      `/admin/customers?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setLoading(false);
  }, [accessToken, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Customers</h1>
        <p className="text-sm text-muted-foreground">Registered storefront accounts.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search email or name…"
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
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.items.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>
                    {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell>{row.phone ?? '—'}</TableCell>
                  <TableCell>{row.orderCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/customers/${row.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
