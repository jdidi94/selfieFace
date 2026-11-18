'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Button, Input, Label, LoadingState } from '@lumea/ui';
import { Locale, type CatalogTaxonomyItem } from '@lumea/types';
import { useEffect, useState } from 'react';

type Kind = 'departments' | 'productTypes' | 'concerns' | 'ingredients';
type Item = CatalogTaxonomyItem & { translations?: { locale: Locale; name: string; description?: string | null }[]; _count?: { products: number } };
const kinds: { value: Kind; label: string }[] = [
  { value: 'departments', label: 'Departments' }, { value: 'productTypes', label: 'Product types' },
  { value: 'concerns', label: 'Skin concerns' }, { value: 'ingredients', label: 'Ingredients' },
];
const locales = [Locale.EN, Locale.AR, Locale.FR];

export default function TaxonomyPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [kind, setKind] = useState<Kind>('departments');
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [names, setNames] = useState<Record<Locale, string>>({ en: '', ar: '', fr: '' });
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    const [data, deps] = await Promise.all([
      adminFetch<Item[]>(`/admin/taxonomy/${kind}`, accessToken),
      adminFetch<Item[]>('/admin/taxonomy/departments', accessToken),
    ]);
    setItems(data); setDepartments(deps); setLoading(false);
  }
  useEffect(() => { if (!authLoading && accessToken) void load(); }, [accessToken, authLoading, market, kind]);

  function reset() { setEditing(null); setNames({ en: '', ar: '', fr: '' }); setSlug(''); setSortOrder('0'); setDepartmentId(''); setIsActive(true); setError(''); }
  function edit(item: Item) {
    const next: Record<Locale, string> = { en: item.name, ar: '', fr: '' };
    for (const translation of item.translations ?? []) next[translation.locale] = translation.name;
    setEditing(item.id); setNames(next); setSlug(item.slug); setSortOrder(String(item.sortOrder)); setDepartmentId(item.departmentId ?? ''); setIsActive(item.isActive !== false); setError('');
  }
  async function save() {
    if (!accessToken) return;
    if (!names.en.trim()) { setError('English name is required.'); return; }
    setSaving(true); setError('');
    const body = { slug: slug.trim() || undefined, sortOrder: Number(sortOrder), isActive, departmentId: kind === 'productTypes' ? departmentId || null : undefined,
      translations: locales.filter((locale) => names[locale].trim()).map((locale) => ({ locale, name: names[locale].trim() })) };
    try {
      await adminFetch(editing ? `/admin/taxonomy/${kind}/${editing}` : `/admin/taxonomy/${kind}`, accessToken, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save taxonomy item.'); }
    finally { setSaving(false); }
  }
  async function remove(item: Item) {
    if (!accessToken) return;
    try { await adminFetch(`/admin/taxonomy/${kind}/${item.id}`, accessToken, { method: 'DELETE' }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete item.'); }
  }

  if (authLoading || loading) return <LoadingState />;
  return <div className="space-y-6">
    <div><h1 className="font-display text-3xl">Product taxonomy</h1><p className="mt-1 text-sm text-muted-foreground">Manage translated navigation and product discovery terms for the selected market.</p></div>
    <div className="flex flex-wrap gap-2">{kinds.map((item) => <Button key={item.value} variant={kind === item.value ? 'primary' : 'outline'} onClick={() => { reset(); setKind(item.value); }}>{item.label}</Button>)}</div>
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-2">
      <h2 className="font-medium md:col-span-2">{editing ? 'Edit item' : `Add ${kinds.find((item) => item.value === kind)?.label.toLowerCase()}`}</h2>
      {locales.map((locale) => <div key={locale} className="space-y-1"><Label htmlFor={`name-${locale}`}>Name ({locale.toUpperCase()}){locale === Locale.EN ? ' *' : ''}</Label><Input id={`name-${locale}`} dir={locale === Locale.AR ? 'rtl' : 'ltr'} value={names[locale]} onChange={(event) => setNames((old) => ({ ...old, [locale]: event.target.value }))} /></div>)}
      <div className="space-y-1"><Label htmlFor="taxonomy-slug">Slug (optional)</Label><Input id="taxonomy-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="taxonomy-order">Navigation order</Label><Input id="taxonomy-order" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></div>
      {kind === 'productTypes' ? <div className="space-y-1"><Label htmlFor="taxonomy-department">Department</Label><select id="taxonomy-department" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">No department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div> : null}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />Active in the storefront</label>
      {error ? <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex gap-2 md:col-span-2"><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create item'}</Button>{editing ? <Button variant="outline" onClick={reset}>Cancel</Button> : null}</div>
    </section>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted/40 text-left"><tr><th className="p-3">English name</th><th className="p-3">Slug</th><th className="p-3">Products</th><th className="p-3">Status</th><th className="p-3">Order</th><th className="p-3" /></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-border"><td className="p-3">{item.name}</td><td className="p-3">{item.slug}</td><td className="p-3">{item._count?.products ?? 0}</td><td className="p-3">{item.isActive === false ? 'Inactive' : 'Active'}</td><td className="p-3">{item.sortOrder}</td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button> <Button size="sm" variant="outline" disabled={!!item._count?.products} onClick={() => void remove(item)}>Delete</Button></td></tr>)}{items.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No items yet.</td></tr> : null}</tbody></table></div>
  </div>;
}
