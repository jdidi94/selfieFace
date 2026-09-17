'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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
import type { AdminAnalyticsResponse, Currency } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const DAY_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All currencies' },
  { value: 'USD', label: 'USD' },
  { value: 'TND', label: 'TND' },
  { value: 'AED', label: 'AED' },
];

function formatRevenueBuckets(
  rows: { currency: Currency; revenue: number; orderCount: number }[],
) {
  if (!rows.length) return '—';
  return rows.map((r) => formatMoney(r.revenue, r.currency)).join(' · ');
}

export default function AnalyticsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('30');
  const [currency, setCurrency] = useState('all');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days });
      if (currency !== 'all') params.set('currency', currency);
      // Prefer admin working market when "all" is selected (scoped analytics).
      const marketCookie =
        typeof document !== 'undefined'
          ? document.cookie.match(/admin_market=([^;]+)/)?.[1]
          : null;
      if (currency === 'all' && marketCookie) {
        params.set('market', marketCookie.toUpperCase());
      }
      const result = await adminFetch<AdminAnalyticsResponse>(
        `/admin/analytics?${params.toString()}`,
        accessToken,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, days, currency]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  const maxDailyRevenue = useMemo(() => {
    if (!data?.revenueByDay.length) return 1;
    return Math.max(...data.revenueByDay.map((p) => p.revenue), 1);
  }, [data]);

  if (authLoading || (loading && !data)) return <LoadingState />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Insights</p>
          <h1 className="font-display mt-1 text-4xl font-medium text-foreground">Analytics</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Revenue, orders, and product performance from paid checkouts. Amounts stay in each
            order&apos;s market currency.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
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
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      {!data ? (
        <EmptyState title="No analytics yet" description="Complete a checkout to populate reports." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Revenue"
              description={`Last ${data.days} days`}
              value={formatRevenueBuckets(data.revenueByCurrency)}
            />
            <MetricCard
              title="Paid orders"
              description="Captured / authorized"
              value={String(data.orderCount)}
            />
            <MetricCard
              title="Pending fulfillment"
              description="Pending + processing"
              value={String(data.pendingFulfillmentCount)}
            />
            <MetricCard
              title="Cancelled"
              description="In selected window"
              value={String(data.cancelledCount)}
            />
          </div>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-foreground">Average order value</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.averageOrderValueByCurrency.length ? (
                data.averageOrderValueByCurrency.map((row) => (
                  <div
                    key={row.currency}
                    className="rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {row.currency}
                    </p>
                    <p className="mt-1 text-xl font-medium text-foreground">
                      {formatMoney(row.revenue, row.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">{row.orderCount} orders</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No paid orders in this window.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-foreground">Revenue by day</h2>
            {!data.revenueByDay.length ? (
              <p className="text-sm text-muted-foreground">No paid revenue in this window.</p>
            ) : (
              <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
                {data.revenueByDay.map((point) => (
                  <div key={`${point.date}-${point.currency}`} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{point.date}</span>
                    <Badge variant="secondary" className="w-12 justify-center">
                      {point.currency}
                    </Badge>
                    <div className="h-2 min-w-0 flex-1 rounded-full bg-surface-muted">
                      <div
                        className="h-2 rounded-full bg-foreground/70"
                        style={{ width: `${Math.max(4, (point.revenue / maxDailyRevenue) * 100)}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-sm text-foreground">
                      {formatMoney(point.revenue, point.currency)}
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {point.orderCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-foreground">Orders by status</h2>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ordersByStatus.length ? (
                      data.ordersByStatus.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No orders in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl text-foreground">Top products</h2>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      {currency !== 'all' && (
                        <TableHead className="text-right">Revenue</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topProducts.length ? (
                      data.topProducts.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell>
                            <Link
                              href={`/catalog/products`}
                              className="hover:underline"
                              title={p.productSlug}
                            >
                              {p.productName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{p.unitsSold}</TableCell>
                          {currency !== 'all' && (
                            <TableCell className="text-right">
                              {formatMoney(p.revenue, currency as Currency)}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={currency !== 'all' ? 3 : 2}
                          className="text-center text-muted-foreground"
                        >
                          No product sales in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {currency === 'all' && (
                <p className="text-xs text-muted-foreground">
                  Filter by a currency to show line revenue for top products.
                </p>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl text-foreground">Low stock</h2>
              <Link href="/catalog/inventory" className="text-sm text-muted-foreground hover:underline">
                Inventory
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStock.length ? (
                    data.lowStock.map((row) => (
                      <TableRow key={row.variantId}>
                        <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell>{row.variantName}</TableCell>
                        <TableCell className="text-right">{row.stock}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No variants at or below the low-stock threshold.
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
