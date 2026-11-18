'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Badge, Button, EmptyState, LoadingState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@lumea/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Issue = 'IMAGE' | 'TRANSLATION' | 'PRICE' | 'STOCK' | 'ATTRIBUTE';
type Completeness = { id: string; name: string; slug: string; status: string; issues: Issue[] };
type CompletenessResponse = { items: Completeness[]; counts: Record<Issue, number>; total: number; scanned: number; truncated: boolean };

const labels: Record<Issue, string> = {
  IMAGE: 'Missing images',
  TRANSLATION: 'Missing translations',
  PRICE: 'Missing market price',
  STOCK: 'No sellable stock',
  ATTRIBUTE: 'Missing product attributes',
};

export default function CatalogCompletenessPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [data, setData] = useState<CompletenessResponse | null>(null);
  const [issue, setIssue] = useState('all');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      setData(await adminFetch<CompletenessResponse>('/admin/catalog-completeness', accessToken, { skipCache: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load catalog issues.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, market]);
  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);
  const rows = useMemo(() => data?.items.filter((row) => (issue === 'all' || row.issues.includes(issue as Issue)) && (status === 'all' || row.status === status)) ?? [], [data, issue, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Catalog completeness</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fix missing product content for {market}. Each item links to its editor.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>Refresh</Button>
      </div>
      {data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.keys(labels) as Issue[]).map((key) => (
          <button key={key} onClick={() => setIssue(issue === key ? 'all' : key)} className={`rounded-lg border p-4 text-start ${issue === key ? 'border-primary bg-surface' : 'border-border bg-surface'}`}>
            <p className="text-xs text-muted-foreground">{labels[key]}</p>
            <p className="mt-2 text-2xl font-medium">{data.counts[key] ?? 0}</p>
          </button>
        ))}
      </div> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="issue-filter">Show</label>
        <Select value={issue} onValueChange={setIssue}>
          <SelectTrigger id="issue-filter" className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All issues</SelectItem>
            {(Object.keys(labels) as Issue[]).map((key) => <SelectItem key={key} value={key}>{labels[key]}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="text-sm" htmlFor="status-filter">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="status-filter" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <LoadingState label="Checking catalog…" /> : rows.length ? (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Issues</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}<span className="block text-xs text-muted-foreground">/{row.slug}</span></TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1">{row.issues.map((code) => <Badge variant="secondary" key={code}>{labels[code]}</Badge>)}</div></TableCell>
              <TableCell className="text-right"><Button asChild size="sm"><Link href={`/catalog/products/${row.id}`}>Fix product</Link></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
      ) : <EmptyState title="Catalog is complete" description="No products need attention for this filter." />}
      {data?.truncated ? <p className="text-xs text-muted-foreground">Showing the first {data.scanned} products scanned. Refine the market or resolve visible issues to continue.</p> : null}
    </div>
  );
}
