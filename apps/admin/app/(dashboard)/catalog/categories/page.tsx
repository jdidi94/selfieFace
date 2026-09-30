'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { CopyToMarketDialog } from '@/components/copy-to-market-dialog';
import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { categoryUpsertSchema } from '@lumea/validation';
import { Locale, type CatalogCategory, type CatalogCopyResult } from '@lumea/types';
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
  const [categoryKind, setCategoryKind] = useState<'CATEGORY' | 'PROBLEM'>('CATEGORY');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<CatalogCategory | null>(null);
  const [pendingCopy, setPendingCopy] = useState<CatalogCategory | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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
    setCategoryKind('CATEGORY');
    setParentCategoryId('');
    setOpen(true);
  }

  function openEdit(item: CatalogCategory) {
    setEditingId(item.id);
    setNames(namesFromCategory(item));
    setCategoryKind(item.kind === 'PROBLEM' ? 'PROBLEM' : 'CATEGORY');
    setParentCategoryId(item.parentCategoryId ?? '');
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
    const validated = validateWithSchema(categoryUpsertSchema, {
      translations,
      kind: categoryKind,
      parentCategoryId: categoryKind === 'PROBLEM' ? parentCategoryId || null : null,
    });
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
            <div className="space-y-2">
              <Label htmlFor="category-kind">Type</Label>
              <select
                id="category-kind"
                className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
                value={categoryKind}
                onChange={(event) => {
                  const next = event.target.value as 'CATEGORY' | 'PROBLEM';
                  setCategoryKind(next);
                  if (next === 'CATEGORY') setParentCategoryId('');
                }}
              >
                <option value="CATEGORY">Main category</option>
                <option value="PROBLEM">Problem subcategory</option>
              </select>
            </div>
            {categoryKind === 'PROBLEM' ? (
              <div className="space-y-2">
                <Label htmlFor="parent-category">Parent category</Label>
                <select
                  id="parent-category"
                  className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
                  value={parentCategoryId}
                  onChange={(event) => setParentCategoryId(event.target.value)}
                >
                  <option value="">Choose a main category</option>
                  {items
                    .filter((item) => item.kind !== 'PROBLEM' && item.id !== editingId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </select>
                <FieldError fieldErrors={fieldErrors} field="parentCategoryId" />
              </div>
            ) : null}
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
              <TableHead>Type</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Translations</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.kind === 'PROBLEM' ? 'Problem' : 'Category'}</TableCell>
                <TableCell>
                  {item.parentCategoryId
                    ? items.find((parent) => parent.id === item.parentCategoryId)?.name ?? '—'
                    : '—'}
                </TableCell>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCopyMessage(null);
                      setPendingCopy(item);
                    }}
                  >
                    Copy to market…
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingDelete(item)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {copyMessage ? (
        <p className="text-sm text-muted-foreground">{copyMessage}</p>
      ) : null}

      <ConfirmTypedDialog
        open={!!pendingDelete}
        title="Delete category"
        description={
          pendingDelete
            ? `This permanently deletes “${pendingDelete.name}”. Products in this category may be affected.`
            : ''
        }
        confirmLabel={typedConfirmToken(pendingDelete?.name, 'DELETE')}
        confirmValue={typedConfirmToken(pendingDelete?.name, 'DELETE')}
        confirmButtonLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <CopyToMarketDialog
        open={!!pendingCopy}
        entityName={pendingCopy?.name ?? ''}
        entityKind="category"
        sourceMarket={market}
        onCancel={() => setPendingCopy(null)}
        onCopy={async (targetMarket) => {
          if (!accessToken || !pendingCopy) {
            throw new Error('Not signed in');
          }
          return adminFetch<CatalogCopyResult>(
            `/admin/categories/${pendingCopy.id}/copy-to-market`,
            accessToken,
            { method: 'POST', body: JSON.stringify({ targetMarket }) },
          );
        }}
        onCopied={(result) => {
          if (!result.warnings.length) {
            setCopyMessage(`Copied category to ${result.targetMarket}`);
          }
        }}
      />
    </div>
  );
}
