'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { ProductPicker } from '@/components/product-picker';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { promotionUpsertSchema } from '@lumea/validation';
import type { PromotionDto } from '@lumea/types';
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@lumea/ui';
import { useEffect, useState } from 'react';

type PromotionForm = {
  name: string;
  slug: string;
  tag: string;
  description: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  productIds: string[];
};

function emptyForm(): PromotionForm {
  return {
    name: '',
    slug: '',
    tag: 'Promotion',
    description: '',
    startsAt: '',
    endsAt: '',
    isActive: true,
    productIds: [],
  };
}

function formFromPromotion(p: PromotionDto): PromotionForm {
  return {
    name: p.name,
    slug: p.slug,
    tag: p.tag,
    description: p.description ?? '',
    startsAt: p.startsAt ? p.startsAt.slice(0, 16) : '',
    endsAt: p.endsAt ? p.endsAt.slice(0, 16) : '',
    isActive: p.isActive,
    productIds: p.productIds,
  };
}

export default function PromotionsAdminPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PromotionDto[]>([]);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!accessToken) return;
    const promos = await adminFetch<PromotionDto[]>('/admin/promotions', accessToken);
    setItems(promos);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(p: PromotionDto) {
    setEditingId(p.id);
    setForm(formFromPromotion(p));
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in to save a promotion');
      return;
    }
    setError(null);
    setFieldErrors({});

    const rawSlug = form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const payload = {
      name: form.name.trim(),
      slug: rawSlug || undefined,
      tag: form.tag.trim(),
      description: form.description.trim() || null,
      startsAt: form.startsAt.trim() || null,
      endsAt: form.endsAt.trim() || null,
      isActive: form.isActive,
      productIds: form.productIds,
    };
    const validated = validateWithSchema(promotionUpsertSchema, payload);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await adminFetch(`/admin/promotions/${editingId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/promotions', accessToken, {
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
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await adminFetch(`/admin/promotions/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Product-level promotion badges. Coupons remain under Coupons.
          </p>
        </div>
        <Button onClick={openCreate}>New campaign</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Tag</TableHead>
            <TableHead>Products</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <Badge variant="accent">{item.tag}</Badge>
              </TableCell>
              <TableCell>{item.productIds.length}</TableCell>
              <TableCell>{item.isActive ? 'Active' : 'Off'}</TableCell>
              <TableCell className="space-x-2 text-end">
                <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void remove(item.id)}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit campaign' : 'New campaign'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="promo-name">Name</Label>
              <Input
                id="promo-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="promo-slug">Slug (optional)</Label>
              <Input
                id="promo-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="promo-tag">Badge tag</Label>
              <Input
                id="promo-tag"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="promo-desc">Description</Label>
              <Textarea
                id="promo-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="promo-start">Starts</Label>
                <Input
                  id="promo-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="promo-end">Ends</Label>
                <Input
                  id="promo-end"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
              Active
            </label>
            <ProductPicker
              accessToken={accessToken}
              value={form.productIds}
              onChange={(productIds) => setForm((f) => ({ ...f, productIds }))}
              label="Products"
              disabled={saving}
            />
            <FieldError fieldErrors={fieldErrors} field="name" />
            <FieldError fieldErrors={fieldErrors} field="tag" />
            <FieldError fieldErrors={fieldErrors} field="endsAt" />
            <FormErrorBanner message={error} />
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
