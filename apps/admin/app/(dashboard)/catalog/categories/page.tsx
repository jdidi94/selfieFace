'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { categoryUpsertSchema } from '@lumea/validation';
import { Locale, type CatalogCategory } from '@lumea/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  LoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { useEffect, useState } from 'react';

const emptyNames = () => ({
  [Locale.EN]: '',
  [Locale.AR]: '',
  [Locale.FR]: '',
});

function namesFromCategory(item: CatalogCategory) {
  const names = emptyNames();
  names[Locale.EN] = item.name;
  for (const t of item.translations ?? []) {
    if (t.locale === Locale.EN || t.locale === Locale.AR || t.locale === Locale.FR) {
      names[t.locale] = t.name;
    }
  }
  return names;
}

export default function CategoriesPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<CatalogCategory[]>([]);
  const [names, setNames] = useState(emptyNames);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!accessToken) return;
    const data = await adminFetch<CatalogCategory[]>('/admin/categories', accessToken);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, market]);

  function resetForm() {
    setNames(emptyNames());
    setEditingId(null);
    setError(null);
    setFieldErrors({});
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: CatalogCategory) {
    setEditingId(item.id);
    setNames(namesFromCategory(item));
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in');
      return;
    }
    setError(null);
    setFieldErrors({});
    const translations = [Locale.EN, Locale.AR, Locale.FR]
      .filter((locale) => names[locale].trim())
      .map((locale) => ({ locale, name: names[locale].trim() }));
    const validated = validateWithSchema(categoryUpsertSchema, { translations });
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await adminFetch(`/admin/categories/${editingId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/categories', accessToken, {
          method: 'POST',
          body: JSON.stringify(validated.data),
        });
      }
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await adminFetch(`/admin/categories/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Categories</h1>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit category' : 'New category'}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue={Locale.EN} className="space-y-3">
              <TabsList>
                <TabsTrigger value={Locale.EN}>EN</TabsTrigger>
                <TabsTrigger value={Locale.AR}>AR</TabsTrigger>
                <TabsTrigger value={Locale.FR}>FR</TabsTrigger>
              </TabsList>
              {([Locale.EN, Locale.AR, Locale.FR] as const).map((locale) => (
                <TabsContent key={locale} value={locale} className="space-y-2">
                  <Label>Name {locale === Locale.EN ? '(required)' : ''}</Label>
                  <Input
                    value={names[locale]}
                    onChange={(e) => setNames((prev) => ({ ...prev, [locale]: e.target.value }))}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </TabsContent>
              ))}
            </Tabs>
            <FieldError fieldErrors={fieldErrors} field="translations" />
            <FormErrorBanner message={error} />
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name (EN)</TableHead>
              <TableHead>Translations</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(item.translations ?? [])
                    .map((t) => t.locale.toUpperCase())
                    .join(' · ') || 'EN'}
                </TableCell>
                <TableCell>{item.slug}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void remove(item.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
