'use client';

import { ApiHealth } from '@/components/api-health';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  EmptyState,
  LoadingState,
  Skeleton,
} from '@lumea/ui';
import type { AdminDashboardResponse, Currency } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function formatRevenueBuckets(
  rows: { currency: Currency; revenue: number }[],
) {
  if (!rows.length) return '—';
  return rows.map((r) => formatMoney(r.revenue, r.currency)).join(' · ');
}

export default function AdminHomePage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<AdminDashboardResponse>(
        '/admin/dashboard?days=30',
        accessToken,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Overview</p>
          <h1 className="font-display mt-1 text-4xl font-medium text-foreground">Dashboard</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Snapshot of paid revenue, open fulfillment, and inventory attention for the last 30 days.
            New here? Read the{' '}
            <Link href="/help" className="underline underline-offset-2 hover:text-foreground">
              Admin guide
            </Link>{' '}
            (media, links, banners, tags).
          </p>
        </div>
        <Link
          href="/analytics"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Full analytics
        </Link>
      </div>

      {authLoading || loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-surface px-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-8 w-28" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Dashboard unavailable" description={error} />
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface px-4 py-4">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="mt-2 text-2xl font-medium text-foreground">
              {formatRevenueBuckets(data.revenueByCurrency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last {data.days} days · {data.orderCount} paid orders
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-4">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="mt-2 text-2xl font-medium text-foreground">
              {data.pendingFulfillmentCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Pending fulfillment</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-4">
            <p className="text-sm text-muted-foreground">Low stock</p>
            <p className="mt-2 text-2xl font-medium text-foreground">{data.lowStockCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href="/catalog/inventory" className="hover:underline">
                Needs attention
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <LoadingState />
      )}

      <ApiHealth />
    </div>
  );
}
