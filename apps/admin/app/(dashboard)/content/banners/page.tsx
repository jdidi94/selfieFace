'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch, mediaUrl, publicApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { promoBannerUpsertSchema } from '@lumea/validation';
import {
  Locale,
  PromoBannerPlacement,
  type PromoBannerDto,
} from '@lumea/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@lumea/ui';
import { Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type BannerForm = {
  placement: PromoBannerPlacement;
  isActive: boolean;
  sortOrder: number;
  href: string;
  imageMediaId: string;
  startsAt: string;
  endsAt: string;
  titles: Record<Locale, string>;
  subtitles: Record<Locale, string>;
  ctaLabels: Record<Locale, string>;
};

function emptyForm(): BannerForm {
  return {
    placement: PromoBannerPlacement.HOME_HERO,
    isActive: true,
    sortOrder: 0,
    href: '',
    imageMediaId: '',
    startsAt: '',
    endsAt: '',
    titles: { [Locale.EN]: '', [Locale.AR]: '', [Locale.FR]: '' },
    subtitles: { [Locale.EN]: '', [Locale.AR]: '', [Locale.FR]: '' },
    ctaLabels: { [Locale.EN]: '', [Locale.AR]: '', [Locale.FR]: '' },
  };
}

function formFromBanner(b: PromoBannerDto): BannerForm {
  const form = emptyForm();
  form.placement = b.placement;
  form.isActive = b.isActive;
  form.sortOrder = b.sortOrder;
  form.href = b.href ?? '';
  form.imageMediaId = b.imageMediaId ?? '';
  form.startsAt = b.startsAt ? b.startsAt.slice(0, 16) : '';
  form.endsAt = b.endsAt ? b.endsAt.slice(0, 16) : '';
  for (const locale of [Locale.EN, Locale.AR, Locale.FR]) {
    const tr = b.translations?.find((t) => t.locale === locale);
    if (tr) {
      form.titles[locale] = tr.title;
      form.subtitles[locale] = tr.subtitle ?? '';
      form.ctaLabels[locale] = tr.ctaLabel ?? '';
    } else if (locale === Locale.EN) {
      form.titles[locale] = b.title;
      form.subtitles[locale] = b.subtitle ?? '';
      form.ctaLabels[locale] = b.ctaLabel ?? '';
    }
  }
  return form;
}

function payloadFromForm(form: BannerForm) {
  const translations = ([Locale.EN, Locale.AR, Locale.FR] as const)
    .filter((locale) => form.titles[locale].trim())
    .map((locale) => ({
      locale,
      title: form.titles[locale].trim(),
      subtitle: form.subtitles[locale].trim() || null,
      ctaLabel: form.ctaLabels[locale].trim() || null,
    }));

  return {
    placement: form.placement,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
    href: form.href.trim() || null,
    imageMediaId: form.imageMediaId.trim() || null,
    startsAt: form.startsAt.trim() || null,
    endsAt: form.endsAt.trim() || null,
    translations,
  };
}

export default function BannersPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PromoBannerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<PromoBannerDto | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    if (!loadedOnce.current) setLoading(true);
    try {
      const data = await adminFetch<PromoBannerDto[]>('/admin/banners', accessToken, {
        skipCache: true,
      });
      setItems(data);
      loadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void load();
  }, [authLoading, accessToken, load]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setImagePreview(null);
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(b: PromoBannerDto) {
    setEditId(b.id);
    setForm(formFromBanner(b));
    setImagePreview(b.imageUrl ? mediaUrl(b.imageUrl) : null);
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  async function uploadImage(file: File) {
    if (!accessToken) {
      setError('You must be signed in to upload');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Image exceeds 5 MB');
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${publicApiUrl}/admin/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
      if (!res.ok) throw new Error('Upload failed');
      const media = (await res.json()) as { id: string; url: string };
      setForm((f) => ({ ...f, imageMediaId: media.id }));
      setImagePreview(mediaUrl(media.url) ?? media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setForm((f) => ({ ...f, imageMediaId: '' }));
    setImagePreview(null);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in to save a banner');
      return;
    }
    setError(null);
    setFieldErrors({});
    const body = payloadFromForm(form);
    const validated = validateWithSchema(promoBannerUpsertSchema, body);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    try {
      if (editId) {
        await adminFetch(`/admin/banners/${editId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/banners', accessToken, {
          method: 'POST',
          body: JSON.stringify(validated.data),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await adminFetch(`/admin/banners/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Promotions</h1>
        <Button onClick={openCreate}>New banner</Button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title (EN)</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.placement}</Badge>
                </TableCell>
                <TableCell>{item.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    Edit
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

      <ConfirmTypedDialog
        open={!!pendingDelete}
        title="Delete banner"
        description={
          pendingDelete
            ? `This permanently deletes the banner “${pendingDelete.title}”.`
            : ''
        }
        confirmLabel={typedConfirmToken(pendingDelete?.title, 'DELETE')}
        confirmValue={typedConfirmToken(pendingDelete?.title, 'DELETE')}
        confirmButtonLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setImagePreview(null);
            setError(null);
            setFieldErrors({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit banner' : 'New banner'}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload a hero image (≤5 MB) or paste a media id. Link examples:{' '}
              <code className="text-xs">/shop</code>, <code className="text-xs">/shop?promotion=1</code>.{' '}
              <Link href="/help#media" className="underline underline-offset-2">
                Full guide
              </Link>
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Placement</Label>
                <Select
                  value={form.placement}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, placement: v as PromoBannerPlacement }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PromoBannerPlacement.HOME_HERO}>Home hero</SelectItem>
                    <SelectItem value={PromoBannerPlacement.HOME_SECONDARY}>Home secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>
            <div className="space-y-2">
              <Label>Link URL (optional)</Label>
              <Input
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="/shop"
              />
            </div>
            <div className="space-y-2">
              <Label>Banner image</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label
                  htmlFor="banner-image-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload from computer'}
                </Label>
                <Input
                  id="banner-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                    e.target.value = '';
                  }}
                />
                {form.imageMediaId || imagePreview ? (
                  <Button type="button" variant="outline" size="sm" onClick={clearImage}>
                    Remove
                  </Button>
                ) : null}
              </div>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt=""
                  className="mt-2 aspect-[16/9] w-full max-w-md rounded-md border border-border object-cover"
                />
              ) : null}
              <Input
                value={form.imageMediaId}
                onChange={(e) => setForm((f) => ({ ...f, imageMediaId: e.target.value }))}
                placeholder="Or paste media id"
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Starts at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>

            <Tabs defaultValue={Locale.EN}>
              <TabsList>
                <TabsTrigger value={Locale.EN}>EN</TabsTrigger>
                <TabsTrigger value={Locale.AR}>AR</TabsTrigger>
                <TabsTrigger value={Locale.FR}>FR</TabsTrigger>
              </TabsList>
              {([Locale.EN, Locale.AR, Locale.FR] as const).map((locale) => (
                <TabsContent key={locale} value={locale} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title {locale === Locale.EN ? '(required)' : ''}</Label>
                    <Input
                      value={form.titles[locale]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          titles: { ...f.titles, [locale]: e.target.value },
                        }))
                      }
                      dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input
                      value={form.subtitles[locale]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          subtitles: { ...f.subtitles, [locale]: e.target.value },
                        }))
                      }
                      dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA label</Label>
                    <Input
                      value={form.ctaLabels[locale]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ctaLabels: { ...f.ctaLabels, [locale]: e.target.value },
                        }))
                      }
                      dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <FieldError fieldErrors={fieldErrors} field="translations" />
            <FormErrorBanner message={error} />
            <Button className="w-full" disabled={uploading} onClick={() => void save()}>
              Save banner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
