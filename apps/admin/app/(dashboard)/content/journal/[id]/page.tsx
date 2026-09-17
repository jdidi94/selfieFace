'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { JournalMarkdownEditor } from '@/components/journal-markdown-editor';
import { ProductPicker } from '@/components/product-picker';
import { adminFetch, mediaUrl, publicApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { journalArticleUpsertSchema } from '@lumea/validation';
import {
  JournalArticleStatus,
  Locale,
  type JournalArticleDetail,
  type JournalArticleTranslationDto,
} from '@lumea/types';
import {
  Button,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@lumea/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type LocaleFields = {
  title: string;
  excerpt: string;
  body: string;
};

type GalleryItem = { mediaId: string; url: string };

const emptyFields = (): Record<Locale, LocaleFields> => ({
  [Locale.EN]: { title: '', excerpt: '', body: '' },
  [Locale.AR]: { title: '', excerpt: '', body: '' },
  [Locale.FR]: { title: '', excerpt: '', body: '' },
});

export default function JournalEditPage() {
  const params = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<JournalArticleStatus>(JournalArticleStatus.DRAFT);
  const [coverMediaId, setCoverMediaId] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recommendedMeta, setRecommendedMeta] = useState<
    { id: string; name: string; slug: string }[]
  >([]);
  const [fields, setFields] = useState(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!accessToken) return;
    const article = await adminFetch<JournalArticleDetail>(
      `/admin/journal/${params.id}`,
      accessToken,
    );
    setSlug(article.slug);
    setStatus(article.status);
    setCoverMediaId(article.coverMediaId ?? '');
    setCoverPreview(article.coverUrl ? mediaUrl(article.coverUrl) : null);
    setGallery(
      (article.gallery ?? []).map((g) => ({
        mediaId: g.mediaId,
        url: mediaUrl(g.url) ?? g.url,
      })),
    );
    const ids =
      article.recommendedProductIds ?? article.recommendedProducts?.map((p) => p.id) ?? [];
    setRecommendedIds(ids);
    setRecommendedMeta(
      (article.recommendedProducts ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
    );
    const next = emptyFields();
    for (const locale of [Locale.EN, Locale.AR, Locale.FR]) {
      const tr = article.translations?.find((t) => t.locale === locale);
      if (tr) {
        next[locale] = {
          title: tr.title,
          excerpt: tr.excerpt ?? '',
          body: tr.body,
        };
      } else if (locale === Locale.EN) {
        next[locale] = {
          title: article.title,
          excerpt: article.excerpt ?? '',
          body: article.body,
        };
      }
    }
    setFields(next);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, params.id]);

  function buildTranslations(): JournalArticleTranslationDto[] {
    return ([Locale.EN, Locale.AR, Locale.FR] as const)
      .filter((locale) => fields[locale].title.trim() || fields[locale].body.trim())
      .map((locale) => ({
        locale,
        title: fields[locale].title.trim() || fields[Locale.EN].title.trim(),
        excerpt: fields[locale].excerpt.trim() || null,
        body: fields[locale].body.trim() || fields[Locale.EN].body.trim(),
      }));
  }

  async function uploadMedia(file: File): Promise<{ id: string; url: string }> {
    if (!accessToken) throw new Error('You must be signed in to upload media');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${publicApiUrl}/admin/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return (await res.json()) as { id: string; url: string };
  }

  async function uploadCover(file: File) {
    setUploading(true);
    setError(null);
    try {
      const media = await uploadMedia(file);
      setCoverMediaId(media.id);
      setCoverPreview(mediaUrl(media.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function uploadGalleryFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: GalleryItem[] = [];
      for (const file of Array.from(files)) {
        const media = await uploadMedia(file);
        uploaded.push({ mediaId: media.id, url: mediaUrl(media.url) ?? media.url });
      }
      setGallery((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in to save this article');
      return;
    }
    setError(null);
    setFieldErrors({});
    const payload = {
      slug: slug.trim() || undefined,
      status,
      coverMediaId: coverMediaId.trim() || null,
      galleryMediaIds: gallery.map((g) => g.mediaId),
      recommendedProductIds: recommendedIds,
      translations: buildTranslations(),
    };
    const validated = validateWithSchema(journalArticleUpsertSchema, payload);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await adminFetch(`/admin/journal/${params.id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      });
      await load();
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/content/journal" className="text-sm text-muted-foreground hover:underline">
            ← Journal
          </Link>
          <h1 className="font-display mt-1 text-3xl">Edit article</h1>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <FieldError fieldErrors={fieldErrors} field="translations" />
      <FormErrorBanner message={error} />

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as JournalArticleStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={JournalArticleStatus.DRAFT}>Draft</SelectItem>
              <SelectItem value={JournalArticleStatus.PUBLISHED}>Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Cover image or video</Label>
          <input
            type="file"
            accept="image/*,video/mp4,video/webm"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="" className="mt-2 max-h-40 rounded-md object-cover" />
          ) : null}
          <Label className="text-xs text-muted-foreground">Or paste media ID</Label>
          <Input
            value={coverMediaId}
            onChange={(e) => setCoverMediaId(e.target.value)}
            placeholder="Media ID"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Gallery images</Label>
          <input
            type="file"
            accept="image/*,video/mp4,video/webm"
            multiple
            disabled={uploading}
            onChange={(e) => void uploadGalleryFiles(e.target.files)}
          />
          {gallery.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {gallery.map((item) => (
                <div key={item.mediaId} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1 rounded bg-surface/90 px-1.5 text-xs"
                    onClick={() =>
                      setGallery((prev) => prev.filter((g) => g.mediaId !== item.mediaId))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <ProductPicker
            accessToken={accessToken}
            value={recommendedIds}
            onChange={setRecommendedIds}
            selectedMeta={recommendedMeta}
            label="Recommended products"
            disabled={saving || uploading}
          />
        </div>
      </div>

      <Tabs defaultValue={Locale.EN} className="space-y-4">
        <TabsList>
          <TabsTrigger value={Locale.EN}>EN</TabsTrigger>
          <TabsTrigger value={Locale.AR}>AR</TabsTrigger>
          <TabsTrigger value={Locale.FR}>FR</TabsTrigger>
        </TabsList>
        {([Locale.EN, Locale.AR, Locale.FR] as const).map((locale) => (
          <TabsContent key={locale} value={locale} className="space-y-4">
            <div className="space-y-2">
              <Label>Title {locale === Locale.EN ? '(required)' : ''}</Label>
              <Input
                value={fields[locale].title}
                onChange={(e) =>
                  setFields((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], title: e.target.value },
                  }))
                }
                dir={locale === Locale.AR ? 'rtl' : 'ltr'}
              />
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea
                rows={2}
                value={fields[locale].excerpt}
                onChange={(e) =>
                  setFields((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], excerpt: e.target.value },
                  }))
                }
                dir={locale === Locale.AR ? 'rtl' : 'ltr'}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <JournalMarkdownEditor
                value={fields[locale].body}
                onChange={(body) =>
                  setFields((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], body },
                  }))
                }
                dir={locale === Locale.AR ? 'rtl' : 'ltr'}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
