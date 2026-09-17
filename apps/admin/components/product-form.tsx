'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { BrandPicker } from '@/components/brand-picker';
import {
  PackComponentPicker,
  type PackComponentSelection,
} from '@/components/pack-component-picker';
import { adminFetch, mediaUrl, publicApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { productCreateSchema, productUpdateSchema } from '@lumea/validation';
import {
  Locale,
  CURRENCY_BY_MARKET,
  type CatalogBrand,
  type CatalogCategory,
  type ProductDetail,
  type PromotionDto,
} from '@lumea/types';
import {
  Button,
  Input,
  Label,
  LoadingState,
  ProductBadge,
  ProductCard,
  type ProductCardLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@lumea/ui';
import { GripVertical, Star, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Props = {
  productId?: string;
};

type LocaleCopy = {
  name: string;
  shortDescription: string;
  description: string;
  benefits: string;
  howToUse: string;
  suitableFor: string;
};

type GalleryImage = {
  mediaId: string;
  url: string;
};

const emptyCopy = (): LocaleCopy => ({
  name: '',
  shortDescription: '',
  description: '',
  benefits: '',
  howToUse: '',
  suitableFor: '',
});

function moneyToMinor(value: string) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function ProductForm({ productId }: Props) {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const currency = CURRENCY_BY_MARKET[market];
  const router = useRouter();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [initialBrand, setInitialBrand] = useState<CatalogBrand | null>(null);
  const [promotions, setPromotions] = useState<PromotionDto[]>([]);
  const [loading, setLoading] = useState(!!productId);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [product, setProduct] = useState<ProductDetail | null>(null);

  const [status, setStatus] = useState('ACTIVE');
  const [kind, setKind] = useState<'PRODUCT' | 'PACK'>('PRODUCT');
  const [packComponents, setPackComponents] = useState<PackComponentSelection[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [isIncoming, setIsIncoming] = useState(false);
  const [incomingAt, setIncomingAt] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [previewPromotion, setPreviewPromotion] = useState(false);
  const [previewTopRated, setPreviewTopRated] = useState(false);
  const [copy, setCopy] = useState<Record<Locale, LocaleCopy>>({
    [Locale.EN]: emptyCopy(),
    [Locale.AR]: emptyCopy(),
    [Locale.FR]: emptyCopy(),
  });
  const [variantName, setVariantName] = useState('Default');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('25.00');
  const [compareAt, setCompareAt] = useState('');
  const [stock, setStock] = useState('10');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  function updateCopy(locale: Locale, patch: Partial<LocaleCopy>) {
    setCopy((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }));
  }

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void Promise.all([
      adminFetch<CatalogCategory[]>('/admin/categories', accessToken),
      adminFetch<PromotionDto[]>('/admin/promotions', accessToken).catch(() => [] as PromotionDto[]),
    ]).then(([cats, promos]) => {
      setCategories(cats);
      setPromotions(promos.filter((p) => p.isActive));
      if (!categoryId && cats[0]) setCategoryId(cats[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap selects once
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (!productId || authLoading || !accessToken) return;
    void adminFetch<ProductDetail>(`/admin/products/${productId}`, accessToken)
      .then((p) => {
        setProduct(p);
        setStatus(p.status);
        setKind((p.kind as 'PRODUCT' | 'PACK') ?? 'PRODUCT');
        setPackComponents(
          (p.packComponents ?? []).map((c) => ({
            variantId: c.variantId,
            quantity: c.quantity,
            productId: c.productId,
            productName: c.productName,
            variantName: c.variantName,
            variantSku: c.variantSku,
          })),
        );
        setCategoryId(p.category.id);
        setBrandId(p.brand.id);
        setInitialBrand({
          id: p.brand.id,
          name: p.brand.name,
          slug: p.brand.slug,
          description: p.brand.description ?? null,
          imageUrl: p.brand.imageUrl ?? null,
        });
        setIsIncoming(!!p.isIncoming);
        setIncomingAt(p.incomingAt ? p.incomingAt.slice(0, 10) : '');
        setTagsText((p.tags ?? []).join(', '));
        const next = {
          [Locale.EN]: emptyCopy(),
          [Locale.AR]: emptyCopy(),
          [Locale.FR]: emptyCopy(),
        };
        for (const t of p.translations ?? []) {
          next[t.locale] = {
            name: t.name,
            shortDescription: t.shortDescription ?? '',
            description: t.description ?? '',
            benefits: t.benefits ?? '',
            howToUse: t.howToUse ?? '',
            suitableFor: t.suitableFor ?? '',
          };
        }
        if (!p.translations?.length) {
          next[Locale.EN] = {
            name: p.name,
            shortDescription: p.shortDescription ?? '',
            description: p.description ?? '',
            benefits: p.benefits ?? '',
            howToUse: p.howToUse ?? '',
            suitableFor: p.suitableFor ?? '',
          };
        }
        setCopy(next);
        const v = p.variants[0];
        if (v) {
          setVariantName(v.name);
          setSku(v.sku);
          setStock(String(v.stock));
          const row = v.prices.find((x) => x.currency === currency);
          if (row) {
            setPrice((row.amount / 100).toFixed(2));
            setCompareAt(
              row.compareAtAmount != null ? (row.compareAtAmount / 100).toFixed(2) : '',
            );
          } else {
            setPrice('25.00');
            setCompareAt('');
          }
        }
        const gallery = [...p.images]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((img) => ({
            mediaId: img.mediaId,
            url: mediaUrl(img.url) ?? img.url,
          }));
        setImages(gallery);
        setGalleryIndex(0);
        if (p.labels?.some((l) => l.kind === 'promotion')) setPreviewPromotion(true);
        if (p.labels?.some((l) => l.kind === 'top_rated')) setPreviewTopRated(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [productId, accessToken, authLoading, currency]);

  useEffect(() => {
    if (!productId || !promotions.length) return;
    const inCampaign = promotions.some((p) => p.productIds?.includes(productId));
    if (inCampaign) setPreviewPromotion(true);
  }, [productId, promotions]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!accessToken) return;
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: GalleryImage[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds 5 MB`);
        }
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${publicApiUrl}/admin/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        const media = (await res.json()) as { id: string; url: string };
        uploaded.push({
          mediaId: media.id,
          url: mediaUrl(media.url) ?? `${publicApiUrl.replace(/\/api$/, '')}${media.url}`,
        });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(mediaId: string) {
    setImages((prev) => {
      const next = prev.filter((img) => img.mediaId !== mediaId);
      setGalleryIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }

  function moveImage(from: number, to: number) {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (!item) return prev;
      next.splice(to, 0, item);
      setGalleryIndex(to);
      return next;
    });
  }

  const selectedBrand = initialBrand;
  const stockNum = Number(stock) || 0;
  const priceMinor = moneyToMinor(price);
  const compareMinor = compareAt.trim() ? moneyToMinor(compareAt) : null;

  const campaignTag = useMemo(() => {
    if (!productId) return 'Promotion';
    const hit = promotions.find((p) => p.productIds?.includes(productId));
    return hit?.tag?.trim() || hit?.name || 'Promotion';
  }, [productId, promotions]);

  const previewLabels: ProductCardLabel[] = useMemo(() => {
    const labels: ProductCardLabel[] = [];
    if (isIncoming) labels.push({ label: 'Incoming', variant: 'outline' });
    if (previewPromotion) labels.push({ label: campaignTag, variant: 'accent' });
    if (previewTopRated) labels.push({ label: 'Top rated', variant: 'secondary' });
    if (stockNum <= 0) labels.push({ label: 'Out of stock', variant: 'outline' });
    return labels;
  }, [isIncoming, previewPromotion, previewTopRated, stockNum, campaignTag]);

  const previewImage =
    images[galleryIndex]?.url ?? images[0]?.url ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      setError('You must be signed in to save a product');
      return;
    }
    setError(null);
    setFieldErrors({});

    const translations = [Locale.EN, Locale.AR, Locale.FR]
      .filter((locale) => copy[locale].name.trim())
      .map((locale) => ({
        locale,
        name: copy[locale].name.trim(),
        shortDescription: copy[locale].shortDescription || null,
        description: copy[locale].description || null,
        benefits: copy[locale].benefits || null,
        howToUse: copy[locale].howToUse || null,
        suitableFor: copy[locale].suitableFor || null,
      }));

    const payload = {
      status,
      kind,
      categoryId,
      brandId,
      isIncoming,
      incomingAt: incomingAt ? new Date(incomingAt).toISOString() : null,
      tags: tagsText
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      packComponents:
        kind === 'PACK'
          ? packComponents.map((c, index) => ({
              variantId: c.variantId,
              quantity: c.quantity,
              sortOrder: index,
            }))
          : [],
      translations,
      imageMediaIds: images.map((img) => img.mediaId),
      variants: [
        {
          ...(product?.variants[0]?.id ? { id: product.variants[0].id } : {}),
          name: variantName,
          sku,
          stock: Number(stock),
          isActive: true,
          prices: [
            {
              currency,
              amount: moneyToMinor(price),
              compareAtAmount: compareAt.trim() ? moneyToMinor(compareAt) : null,
            },
          ],
        },
      ],
    };

    const schema = productId ? productUpdateSchema : productCreateSchema;
    const validated = validateWithSchema(schema, payload);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }

    setPending(true);
    try {
      if (productId) {
        await adminFetch(`/admin/products/${productId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/products', accessToken, {
          method: 'POST',
          body: JSON.stringify(validated.data),
        });
      }
      router.push('/catalog/products');
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    } finally {
      setPending(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <h1 className="font-display text-3xl">{productId ? 'Edit product' : 'New product'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload many gallery images. The live card on the right mirrors storefront tags and
            prices before you save.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <select
              id="kind"
              className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'PRODUCT' | 'PACK')}
            >
              <option value="PRODUCT">PRODUCT</option>
              <option value="PACK">PACK (bundle)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <BrandPicker
            accessToken={accessToken}
            value={brandId}
            onChange={setBrandId}
            onSelectBrand={setInitialBrand}
            initialBrand={initialBrand}
            required
          />
        </div>

        {kind === 'PACK' ? (
          <PackComponentPicker
            accessToken={accessToken}
            value={packComponents}
            onChange={setPackComponents}
            excludeProductId={productId}
            disabled={pending}
          />
        ) : null}

        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Storefront tags (preview)</p>
          <div className="space-y-2">
            <Label htmlFor="product-tags">Catalog tags (comma-separated)</Label>
            <Input
              id="product-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="spf, hydrating, new"
            />
            <p className="text-xs text-muted-foreground">
              Used by coupon include/exclude rules and merchandising filters.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isIncoming}
                onChange={(e) => setIsIncoming(e.target.checked)}
              />
              Incoming / coming soon
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={previewPromotion}
                onChange={(e) => setPreviewPromotion(e.target.checked)}
              />
              Promotion campaign badge
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={previewTopRated}
                onChange={(e) => setPreviewTopRated(e.target.checked)}
              />
              Top rated (reviews)
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="incomingAt">Expected date (optional)</Label>
            <Input
              id="incomingAt"
              type="date"
              value={incomingAt}
              onChange={(e) => setIncomingAt(e.target.value)}
              disabled={!isIncoming}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Promotion badges on the live site come from{' '}
            <strong>Marketing → Campaigns</strong>. Coupons (e.g. WELCOME10) apply at checkout — not
            as card tags. Use the checkboxes above to visualize badges before inventory publish.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-medium">Catalog copy (EN / AR / FR)</p>
          <Tabs defaultValue={Locale.EN}>
            <TabsList>
              <TabsTrigger value={Locale.EN}>English</TabsTrigger>
              <TabsTrigger value={Locale.AR}>العربية</TabsTrigger>
              <TabsTrigger value={Locale.FR}>Français</TabsTrigger>
            </TabsList>
            {([Locale.EN, Locale.AR, Locale.FR] as const).map((locale) => (
              <TabsContent key={locale} value={locale} className="space-y-3 pt-3">
                <div className="space-y-2">
                  <Label>Name {locale === Locale.EN ? '(required)' : ''}</Label>
                  <Input
                    value={copy[locale].name}
                    onChange={(e) => updateCopy(locale, { name: e.target.value })}
                    required={locale === Locale.EN}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Short description</Label>
                  <Textarea
                    value={copy[locale].shortDescription}
                    onChange={(e) => updateCopy(locale, { shortDescription: e.target.value })}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={copy[locale].description}
                    onChange={(e) => updateCopy(locale, { description: e.target.value })}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Benefits</Label>
                  <Textarea
                    value={copy[locale].benefits}
                    onChange={(e) => updateCopy(locale, { benefits: e.target.value })}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>How to use</Label>
                  <Textarea
                    value={copy[locale].howToUse}
                    onChange={(e) => updateCopy(locale, { howToUse: e.target.value })}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suitable for</Label>
                  <Textarea
                    value={copy[locale].suitableFor}
                    onChange={(e) => updateCopy(locale, { suitableFor: e.target.value })}
                    dir={locale === Locale.AR ? 'rtl' : 'ltr'}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-medium">Primary variant & prices</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Variant name</Label>
              <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Price ({currency})</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Compare-at ({currency})</Label>
              <Input
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Stock</Label>
              <Input value={stock} onChange={(e) => setStock(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Gallery images</p>
              <p className="text-xs text-muted-foreground">
                Add many images (≤5 MB each). First image is the card cover; reorder with arrows.
              </p>
            </div>
            <Label
              htmlFor="gallery-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Add images'}
            </Label>
            <Input
              id="gallery-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) void uploadFiles(list);
                e.target.value = '';
              }}
            />
          </div>

          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images yet — upload to preview the card.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {images.map((img, index) => (
                <li
                  key={img.mediaId}
                  className={`flex gap-3 rounded-md border p-2 ${
                    index === galleryIndex ? 'border-accent' : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    className="h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-surface-muted"
                    onClick={() => setGalleryIndex(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {index === 0 ? 'Cover · ' : ''}
                      {img.mediaId}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveImage(index, index - 1)}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={index === images.length - 1}
                        onClick={() => moveImage(index, index + 1)}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeImage(img.mediaId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FieldError fieldErrors={fieldErrors} field="translations" />
        <FieldError fieldErrors={fieldErrors} field="categoryId" />
        <FieldError fieldErrors={fieldErrors} field="brandId" />
        <FieldError fieldErrors={fieldErrors} field="variants" />
        <FormErrorBanner message={error} />

        <div className="flex gap-3">
          <Button type="submit" disabled={pending || uploading}>
            {pending ? 'Saving…' : 'Save product'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/catalog/products')}>
            Cancel
          </Button>
        </div>
      </form>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Live card</p>
            <ProductBadge label="Preview" variant="outline" />
          </div>
          <ProductCard
            name={copy[Locale.EN].name.trim() || 'Product name'}
            href="#"
            imageUrl={previewImage}
            priceFrom={priceMinor}
            compareAtFrom={
              compareMinor != null && compareMinor > priceMinor ? compareMinor : null
            }
            currency="USD"
            brandName={selectedBrand?.name}
            brandImageUrl={mediaUrl(selectedBrand?.imageUrl) ?? selectedBrand?.imageUrl}
            labels={previewLabels}
            averageRating={previewTopRated ? 4.8 : null}
            reviewCount={previewTopRated ? 12 : 0}
            className="pointer-events-none"
          />
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.mediaId}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  className={`h-12 w-10 shrink-0 overflow-hidden rounded-sm border ${
                    i === galleryIndex ? 'border-accent' : 'border-border'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Coupons are checkout-only. Attach campaigns under Marketing → Campaigns for real
              Promotion tags after save.
            </p>
            {copy[Locale.EN].shortDescription ? (
              <p className="line-clamp-3">{copy[Locale.EN].shortDescription}</p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
