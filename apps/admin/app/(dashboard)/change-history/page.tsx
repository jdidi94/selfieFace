'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Button, Input, LoadingState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@lumea/ui';
import { useCallback, useEffect, useState } from 'react';

type HistoryRow = {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  field: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  admin: { firstName?: string | null; lastName?: string | null; email: string } | null;
};

function renderValue(value: unknown) {
  if (value == null) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export default function ChangeHistoryPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [entityType, setEntityType] = useState('');
  const [field, setField] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ take: '100' });
    if (entityType) query.set('entityType', entityType);
    if (field.trim()) query.set('field', field.trim());
    try {
      setItems(await adminFetch<HistoryRow[]>(`/admin/change-history?${query}`, accessToken, { skipCache: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load change history.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, entityType, field, market]);
  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-3xl">Change history</h1><p className="text-sm text-muted-foreground">Product, price, stock, and promotion changes · {market}</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}>Refresh</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Entity type" className="h-10 rounded-md border border-input bg-surface px-3 text-sm" value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="">All entities</option><option value="PRODUCT">Products</option><option value="INVENTORY">Inventory</option><option value="PROMOTION">Promotions</option></select>
      <Input className="max-w-xs" placeholder="Filter by field" value={field} onChange={(event) => setField(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} />
      <Button variant="outline" onClick={() => void load()}>Filter</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {loading ? <LoadingState /> : <div className="rounded-lg border border-border bg-surface"><Table>
      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Item</TableHead><TableHead>Field</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead></TableRow></TableHeader>
      <TableBody>{items.map((row) => <TableRow key={row.id}>
        <TableCell className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</TableCell>
        <TableCell>{row.admin ? `${row.admin.firstName ?? ''} ${row.admin.lastName ?? ''}`.trim() || row.admin.email : 'Deleted admin'}</TableCell>
        <TableCell>{row.entityName}<span className="block text-xs text-muted-foreground">{row.entityType} · {row.entityId}</span></TableCell>
        <TableCell>{row.field}</TableCell><TableCell className="max-w-48 break-words">{renderValue(row.before)}</TableCell><TableCell className="max-w-48 break-words">{renderValue(row.after)}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>}
    {!loading && !items.length && !error ? <p className="text-sm text-muted-foreground">No recorded changes match these filters.</p> : null}
  </div>;
}
