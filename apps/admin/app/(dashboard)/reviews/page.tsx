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
import type { AdminReviewListResponse, ReviewStatus } from '@lumea/types';
import { useCallback, useEffect, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function statusVariant(status: ReviewStatus): 'default' | 'secondary' | 'outline' | 'accent' {
  if (status === 'REJECTED') return 'accent';
  if (status === 'APPROVED') return 'secondary';
  return 'outline';
}

export default function ReviewsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminReviewListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<AdminReviewListResponse>(
      `/admin/reviews?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setLoading(false);
  }, [accessToken, status, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  async function moderate(id: string, next: 'APPROVED' | 'REJECTED') {
    if (!accessToken) return;
    try {
      await adminFetch(`/admin/reviews/${id}/status`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      toast(`Review ${next === 'APPROVED' ? 'approved' : 'rejected'}`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Moderation failed');
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Reviews</h1>
        <p className="text-sm text-muted-foreground">Moderate customer product reviews.</p>
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
          placeholder="Search product, email, text…"
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
              <TableHead>Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="max-w-md">Excerpt</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.items.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No reviews match your filters.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.productName}</p>
                    <p className="text-xs text-muted-foreground">{row.productSlug}</p>
                  </TableCell>
                  <TableCell className="text-sm">{row.customerEmail}</TableCell>
                  <TableCell>{row.rating}/5</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                    {row.title ? `${row.title} — ` : ''}
                    {row.body}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {row.status !== 'APPROVED' && (
                      <Button size="sm" onClick={() => void moderate(row.id, 'APPROVED')}>
                        Approve
                      </Button>
                    )}
                    {row.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moderate(row.id, 'REJECTED')}
                      >
                        Reject
                      </Button>
                    )}
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
