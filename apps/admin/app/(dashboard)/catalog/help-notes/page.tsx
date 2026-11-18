'use client';

import { ContextualHelp } from '@/components/contextual-help';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Button, Input, Label, LoadingState, Textarea } from '@lumea/ui';
import { useEffect, useState } from 'react';

type Note = { id: string; fieldKey: string; title: string; contentEn: string; contentAr?: string | null; contentFr?: string | null; isActive: boolean };
const fields = [
  ['product.name', 'Product name'], ['product.description', 'Product description'], ['product.category', 'Product category'],
  ['product.price', 'Product price'], ['product.stock', 'Product stock'], ['product.images', 'Product images'],
  ['categories.isActive', 'Category active status'], ['inventory.adjustment', 'Inventory adjustment'],
  ['coupons.discount', 'Coupon discount'], ['settings.lowStockThreshold', 'Low stock threshold'],
] as const;

export default function HelpNotesPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [notes, setNotes] = useState<Note[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldKey, setFieldKey] = useState<string>(fields[0][0]);
  const [title, setTitle] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentAr, setContentAr] = useState('');
  const [contentFr, setContentFr] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    const result = await adminFetch<{ enabled: boolean; items: Note[] }>('/admin/help-notes', accessToken, { skipCache: true });
    setEnabled(result.enabled);
    setNotes(result.items);
    setLoading(false);
  }
  useEffect(() => { if (!authLoading && accessToken) void load().catch((e) => { setError(e instanceof Error ? e.message : 'Unable to load notes'); setLoading(false); }); }, [accessToken, authLoading, market]);

  function edit(note?: Note) {
    setFieldKey(note?.fieldKey ?? fields[0][0]);
    setTitle(note?.title ?? '');
    setContentEn(note?.contentEn ?? '');
    setContentAr(note?.contentAr ?? '');
    setContentFr(note?.contentFr ?? '');
    setIsActive(note?.isActive ?? true);
    setError('');
  }
  async function save() {
    if (!accessToken) return;
    setSaving(true); setError('');
    try {
      await adminFetch(`/admin/help-notes/${encodeURIComponent(fieldKey)}`, accessToken, { method: 'PUT', body: JSON.stringify({ title, contentEn, contentAr, contentFr, isActive }) });
      await load();
      window.dispatchEvent(new Event('admin-help-notes-updated'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save note'); }
    finally { setSaving(false); }
  }
  async function toggleGlobal() {
    if (!accessToken) return;
    const next = !enabled;
    await adminFetch('/admin/help-notes/settings', accessToken, { method: 'PATCH', body: JSON.stringify({ enabled: next }) });
    setEnabled(next);
    window.dispatchEvent(new Event('admin-help-notes-updated'));
  }
  async function toggleNote(note: Note) {
    if (!accessToken) return;
    await adminFetch(`/admin/help-notes/${encodeURIComponent(note.fieldKey)}`, accessToken, { method: 'PUT', body: JSON.stringify({ title: note.title, contentEn: note.contentEn, contentAr: note.contentAr, contentFr: note.contentFr, isActive: !note.isActive }) });
    await load();
    window.dispatchEvent(new Event('admin-help-notes-updated'));
  }
  if (authLoading || loading) return <LoadingState />;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-3xl">Contextual help notes</h1><p className="mt-1 text-sm text-muted-foreground">Manage the explanations admins see beside fields.</p></div>
      <Button variant={enabled ? 'accent' : 'outline'} onClick={() => void toggleGlobal()}>{enabled ? 'Help notes enabled' : 'Help notes disabled'}</Button>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">Notes by field</h2>
        {notes.length ? notes.map((note) => <div key={note.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
          <div><p className="font-medium">{note.title} <span className="font-normal text-muted-foreground">· {note.fieldKey}</span></p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note.contentEn}</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(note)}>Edit</Button><Button size="sm" variant={note.isActive ? 'secondary' : 'outline'} onClick={() => void toggleNote(note)}>{note.isActive ? 'Disable' : 'Enable'}</Button></div>
        </div>) : <p className="text-sm text-muted-foreground">No help notes yet.</p>}
      </section>
      <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between"><h2 className="font-medium">Create or moderate a note</h2><Button size="sm" variant="outline" onClick={() => edit()}>New</Button></div>
        <div className="space-y-2"><Label htmlFor="help-field">Show beside field</Label><select id="help-field" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}>{fields.map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>)}{!fields.some(([key]) => key === fieldKey) ? <option value={fieldKey}>{fieldKey}</option> : null}</select><Input aria-label="Custom field key" value={fields.some(([key]) => key === fieldKey) ? '' : fieldKey} placeholder="Or enter a custom field key" onChange={(e) => setFieldKey(e.target.value)} /></div>
        <div className="space-y-2"><Label>Note title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
        <div className="space-y-2"><Label>English explanation</Label><Textarea value={contentEn} onChange={(e) => setContentEn(e.target.value)} maxLength={4000} rows={4} /></div>
        <div className="space-y-2"><Label>Arabic explanation (optional)</Label><Textarea dir="rtl" value={contentAr} onChange={(e) => setContentAr(e.target.value)} maxLength={4000} rows={3} /></div>
        <div className="space-y-2"><Label>French explanation (optional)</Label><Textarea value={contentFr} onChange={(e) => setContentFr(e.target.value)} maxLength={4000} rows={3} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Visible beside the assigned field</label>
        <ContextualHelp fieldKey={fieldKey} />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={() => void save()} disabled={saving || !title.trim() || !contentEn.trim()}>{saving ? 'Saving…' : 'Save note'}</Button>
      </section>
    </div>
  </div>;
}
