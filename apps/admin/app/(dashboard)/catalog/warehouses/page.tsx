'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { warehouseUpdateSchema, warehouseUpsertSchema } from '@lumea/validation';
import type { WarehouseDto } from '@lumea/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { useEffect, useState } from 'react';

const emptyForm = () => ({
  name: '',
  code: '',
  line1: '',
  city: '',
  country: '',
  isActive: true,
  isDefault: false,
});

export default function WarehousesPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<WarehouseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!accessToken) return;
    const data = await adminFetch<WarehouseDto[]>('/admin/warehouses', accessToken);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, market]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(item: WarehouseDto) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      line1: item.line1 ?? '',
      city: item.city ?? '',
      country: item.country ?? '',
      isActive: item.isActive,
      isDefault: item.isDefault,
    });
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in');
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toLowerCase(),
      line1: form.line1.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };
    const schema = editingId ? warehouseUpdateSchema : warehouseUpsertSchema;
    const validated = validateWithSchema(schema, payload);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors ?? {});
      setSaving(false);
      return;
    }
    try {
      if (editingId) {
        await adminFetch(`/admin/warehouses/${editingId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/warehouses', accessToken, {
          method: 'POST',
          body: JSON.stringify(validated.data),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Selfieface stock locations. Checkout sells from the default warehouse first, then others.
          </p>
        </div>
        <Button onClick={openCreate}>Add warehouse</Button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    {item.name}
                    {item.isDefault ? <Badge variant="accent">Default</Badge> : null}
                  </span>
                </TableCell>
                <TableCell>{item.code}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[item.city, item.country].filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell>
                  {item.isActive ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit warehouse' : 'New warehouse'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <FieldError fieldErrors={fieldErrors} field="name" />
            </div>
            <div className="space-y-2">
              <Label>Code (slug)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                disabled={!!editingId}
              />
              <FieldError fieldErrors={fieldErrors} field="code" />
            </div>
            <div className="space-y-2">
              <Label>Address line</Label>
              <Input
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="TN"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active (counts toward storefront stock)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Default fulfillment warehouse
            </label>
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
