'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { marketLabel, useAdminMarket } from '@/lib/market-context';
import {
  Badge,
  EmptyState,
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
import type { AdminBehaviorStatsResponse, BehaviorEventType } from '@lumea/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const DAY_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function eventTypeLabel(type: BehaviorEventType | string) {
  switch (type) {
    case 'SEARCH':
      return 'Search';
    case 'PRODUCT_CLICK':
      return 'Product click';
    case 'PAGE_VIEW':
      return 'Page view';
    default:
      return type;
  }
}

export default function BehaviorPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [data, setData] = useState<AdminBehaviorStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('30');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<AdminBehaviorStatsResponse>(
        `/admin/behavior/stats?days=${days}`,
        accessToken,
        { skipCache: true },
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load behavior stats');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, days]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  if (authLoading || (loading && !data)) return <LoadingState />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Insights</p>
          <h1 className="font-display mt-1 text-4xl font-medium text-foreground">Behavior</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Storefront searches, product clicks, and page views for{' '}
            {marketLabel(market)}. Totals respect the working market header.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      {!data ? (
        <EmptyState
          title="No behavior data yet"
          description="Browse the storefront to collect searches, clicks, and page views."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Searches"
              description={`Last ${data.days} days`}
              value={String(data.totals.searches)}
            />
            <MetricCard
              title="Product clicks"
              description="Product card / detail taps"
              value={String(data.totals.productClicks)}
            />
            <MetricCard
              title="Page views"
              description="Route changes"
              value={String(data.totals.pageViews)}
            />
            <MetricCard
              title="Unique sessions"
              description="Distinct session IDs"
              value={String(data.totals.uniqueSessions)}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-foreground">Top products by clicks</h2>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topProducts.length ? (
                      data.topProducts.map((row) => (
                        <TableRow key={row.productId}>
                          <TableCell>
                            <Link
                              href="/catalog/products"
                              className="hover:underline"
                              title={row.productSlug}
                            >
                              {row.productName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{row.clickCount}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No product clicks in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl text-foreground">Top search queries</h2>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topSearches.length ? (
                      data.topSearches.map((row) => (
                        <TableRow key={row.query}>
                          <TableCell className="font-medium">{row.query}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No searches in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-foreground">Recent events</h2>
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentEvents.length ? (
                    data.recentEvents.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{eventTypeLabel(row.type)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm">
                          {row.query ?? row.productId ?? (row.userId ? `user ${row.userId.slice(0, 8)}…` : '—')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                          {row.path ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No events in this window.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-medium text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
