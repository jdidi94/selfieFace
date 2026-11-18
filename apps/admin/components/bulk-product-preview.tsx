'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Label } from '@lumea/ui';
import { useEffect, useState } from 'react';

type NamedItem = { id: string; name: string };
type PreviewRow = {
  id: string;
  name: string;
  before: { status: string; category: string; brand: string; tags: string[] };
  after: { status: string; category: string; brand: string; tags: string[] };
  changes: string[];
};
type Preview = { selected: number; changed: number; items: PreviewRow[] };

export function BulkProductPreview({ productIds, onApplied }: { productIds: string[]; onApplied: (summary: string) => void }) {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [addTags, setAddTags] = useState('');
  const [removeTags, setRemoveTags] = useState('');
  const [categories, setCategories] = useState<NamedItem[]>([]);
  const [brands, setBrands] = useState<NamedItem[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPreview(null);
    setMessage('');
  }, [productIds.join('|'), status, categoryId, brandId, addTags, removeTags]);

  useEffect(() => {
    if (!accessToken) return;
    void Promise.all([
      adminFetch<NamedItem[]>('/admin/categories', accessToken),
      adminFetch<NamedItem[]>('/admin/brands', accessToken),
    ]).then(([categoryRows, brandRows]) => {
      setCategories(categoryRows);
      setBrands(brandRows);
    }).catch(() => undefined);
  }, [accessToken]);

  function payload() {
    const parseTags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean);
    return {
      productIds,
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(addTags.trim() ? { addTags: parseTags(addTags) } : {}),
      ...(removeTags.trim() ? { removeTags: parseTags(removeTags) } : {}),
    };
  }

  async function showPreview() {
    if (!accessToken) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await adminFetch<Preview>('/admin/products/bulk-update/preview', accessToken, {
        method: 'POST', body: JSON.stringify(payload()),
      });
      setPreview(result);
      if (!result.changed) setMessage('These products already have the requested values.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not build a preview.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!accessToken || !preview?.changed) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await adminFetch<{ selected: number; updated: number; skipped: number }>(
        '/admin/products/bulk-update/apply', accessToken,
        { method: 'POST', body: JSON.stringify(payload()) },
      );
      const summary = `${result.updated} of ${result.selected} selected products updated; ${result.skipped} unchanged.`;
      setMessage(summary);
      onApplied(summary);
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not apply these changes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-medium">Bulk edit · preview first</h2>
        <p className="text-xs text-muted-foreground">Changes are only applied after you review and confirm the preview.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="bulk-status">Publication status</Label><select id="bulk-status" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Keep current</option><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></div>
        <div className="space-y-1"><Label htmlFor="bulk-category">Category</Label><select id="bulk-category" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Keep current</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="bulk-brand">Brand</Label><select id="bulk-brand" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Keep current</option>{brands.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="bulk-add-tags">Add tags</Label><Input id="bulk-add-tags" value={addTags} onChange={(event) => setAddTags(event.target.value)} placeholder="Comma-separated" /></div>
        <div className="space-y-1"><Label htmlFor="bulk-remove-tags">Remove tags</Label><Input id="bulk-remove-tags" value={removeTags} onChange={(event) => setRemoveTags(event.target.value)} placeholder="Comma-separated" /></div>
        <div className="flex items-end"><Button disabled={busy || productIds.length === 0} onClick={() => void showPreview()}>{busy ? 'Preparing…' : 'Preview changes'}</Button></div>
      </div>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      {preview ? <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm">Preview: {preview.changed} of {preview.selected} products will change.</p>
        <div className="max-h-72 space-y-2 overflow-auto">
          {preview.items.filter((item) => item.changes.length > 0).map((item) => <article key={item.id} className="rounded-md border border-border p-3 text-xs">
            <p className="mb-2 font-medium">{item.name} · {item.changes.join(', ')}</p>
            <div className="grid gap-2 md:grid-cols-2"><pre className="overflow-auto rounded bg-surface-muted p-2">Before: {JSON.stringify(item.before, null, 2)}</pre><pre className="overflow-auto rounded bg-surface-muted p-2">After: {JSON.stringify(item.after, null, 2)}</pre></div>
          </article>)}
        </div>
        <Button disabled={busy || preview.changed === 0} onClick={() => void apply()}>{busy ? 'Applying…' : 'Confirm and apply'}</Button>
      </div> : null}
    </section>
  );
}
