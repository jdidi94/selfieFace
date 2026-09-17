'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch, mediaUrl, publicApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { brandUpsertSchema } from '@lumea/validation';
import { Locale, type CatalogBrand } from '@lumea/types';
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
import { Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

const emptyNames = () => ({
  [Locale.EN]: '',
  [Locale.AR]: '',
  [Locale.FR]: '',
});

function namesFromBrand(item: CatalogBrand) {
  const names = emptyNames();
  names[Locale.EN] = item.name;
  for (const t of item.translations ?? []) {
    if (t.locale === Locale.EN || t.locale === Locale.AR || t.locale === Locale.FR) {
      names[t.locale] = t.name;
    }
  }
  return names;
}

export default function BrandsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<CatalogBrand[]>([]);
  const [names, setNames] = useState(emptyNames);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!accessToken) return;
    const data = await adminFetch<CatalogBrand[]>('/admin/brands', accessToken);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, market]);

  function resetForm() {
    setNames(emptyNames());
    setImageUrl('');
    setImagePreview(null);
    setEditingId(null);
    setError(null);
    setFieldErrors({});
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: CatalogBrand) {
    setEditingId(item.id);
    setNames(namesFromBrand(item));
    setImageUrl(item.imageUrl ?? '');
    setImagePreview(item.imageUrl ? mediaUrl(item.imageUrl) : null);
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  async function uploadPhoto(file: File) {
    if (!accessToken) {
      setError('You must be signed in to upload');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Image exceeds 5 MB');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${publicApiUrl}/admin/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const media = (await res.json()) as { id: string; url: string };
      const url = mediaUrl(media.url) ?? media.url;
      setImageUrl(media.url);
      setImagePreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
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
    const validated = validateWithSchema(brandUpsertSchema, {
      translations,
      imageUrl: imageUrl.trim() || null,
    });
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await adminFetch(`/admin/brands/${editingId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/brands', accessToken, {
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
    await adminFetch(`/admin/brands/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Brands</h1>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add brand</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit brand' : 'New brand'}</DialogTitle>
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
            <div className="space-y-2">
              <Label>Brand photo</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label
                  htmlFor="brand-photo-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload from computer'}
                </Label>
                <Input
                  id="brand-photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt=""
                  className="mt-2 h-20 w-20 rounded-md border border-border object-cover"
                />
              ) : null}
              <Input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value.trim() ? mediaUrl(e.target.value) : null);
                }}
                placeholder="Or paste image URL /media path"
              />
            </div>
            <FieldError fieldErrors={fieldErrors} field="translations" />
            <FieldError fieldErrors={fieldErrors} field="imageUrl" />
            <FormErrorBanner message={error} />
            <Button onClick={() => void save()} disabled={uploading || saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name (EN)</TableHead>
              <TableHead>Translations</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(item.imageUrl) ?? item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
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
