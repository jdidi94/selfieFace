'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { CopyToMarketDialog } from '@/components/copy-to-market-dialog';
import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { ProductPicker } from '@/components/product-picker';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { couponUpsertSchema } from '@lumea/validation';
import {
  CouponProductScope,
  CouponType,
  CURRENCY_BY_MARKET,
  type CatalogCopyResult,
  type CouponDto,
} from '@lumea/types';
import { formatMoney } from '@lumea/utils';
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
} from '@lumea/ui';
import { useEffect, useState } from 'react';

type CouponForm = {
  code: string;
  type: CouponType;
  description: string;
  percentOff: string;
  amountOff: string;
  minSubtotal: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  productScope: CouponProductScope;
  productTags: string;
  productIds: string[];
  ruleIsNew: boolean;
  ruleMinPriceUsd: string;
  ruleMinRating: string;
};

function emptyForm(): CouponForm {
  return {
    code: '',
    type: CouponType.PERCENT,
    description: '',
    percentOff: '10',
    amountOff: '',
    minSubtotal: '',
    maxUses: '',
    maxUsesPerCustomer: '',
    startsAt: '',
    endsAt: '',
    isActive: true,
    productScope: CouponProductScope.ALL,
    productTags: '',
    productIds: [],
    ruleIsNew: false,
    ruleMinPriceUsd: '',
    ruleMinRating: '',
  };
}

function formFromCoupon(c: CouponDto): CouponForm {
  return {
    code: c.code,
    type: c.type,
    description: c.description ?? '',
    percentOff: c.percentOff != null ? String(c.percentOff) : '',
    amountOff: c.amountOff != null ? String(c.amountOff) : '',
    minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : '',
    maxUses: c.maxUses != null ? String(c.maxUses) : '',
    maxUsesPerCustomer: c.maxUsesPerCustomer != null ? String(c.maxUsesPerCustomer) : '',
    startsAt: c.startsAt ? c.startsAt.slice(0, 16) : '',
    endsAt: c.endsAt ? c.endsAt.slice(0, 16) : '',
    isActive: c.isActive,
    productScope: c.productScope ?? CouponProductScope.ALL,
    productTags: (c.productTags ?? []).join(', '),
    productIds: c.productIds ?? [],
    ruleIsNew: c.ruleIsNew ?? false,
    ruleMinPriceUsd: c.ruleMinPriceUsd != null ? String(c.ruleMinPriceUsd) : '',
    ruleMinRating: c.ruleMinRating != null ? String(c.ruleMinRating) : '',
  };
}

function intOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function floatOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function splitList(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function payloadFromForm(form: CouponForm) {
  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    description: form.description.trim() || null,
    percentOff: form.type === CouponType.PERCENT ? intOrNull(form.percentOff) : null,
    amountOff: form.type === CouponType.FIXED ? intOrNull(form.amountOff) : null,
    minSubtotal: intOrNull(form.minSubtotal),
    maxUses: intOrNull(form.maxUses),
    maxUsesPerCustomer: intOrNull(form.maxUsesPerCustomer),
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    isActive: form.isActive,
    productScope: form.productScope,
    productTags: splitList(form.productTags),
    productIds: form.productIds,
    ruleIsNew: form.ruleIsNew,
    ruleMinPriceUsd: intOrNull(form.ruleMinPriceUsd),
    ruleMinRating: floatOrNull(form.ruleMinRating),
  };
}

function summarizeDiscount(c: CouponDto) {
  if (c.type === CouponType.PERCENT) return `${c.percentOff ?? 0}% off`;
  const currency = c.marketCode ? CURRENCY_BY_MARKET[c.marketCode] : 'USD';
  return c.amountOff != null ? formatMoney(c.amountOff, currency) : 'Fixed';
}

export default function CouponsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const currency = CURRENCY_BY_MARKET[market];
  const [items, setItems] = useState<CouponDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<CouponDto | null>(null);
  const [pendingCopy, setPendingCopy] = useState<CouponDto | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load() {
    if (!accessToken) return;
    const data = await adminFetch<CouponDto[]>('/admin/coupons', accessToken);
    setItems(data);
    setSelectedCouponIds([]);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, market]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(c: CouponDto) {
    setEditId(c.id);
    setForm(formFromCoupon(c));
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in to save a coupon');
      return;
    }
    setError(null);
    setFieldErrors({});
    const body = payloadFromForm(form);
    const validated = validateWithSchema(couponUpsertSchema, body);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    try {
      if (editId) {
        await adminFetch(`/admin/coupons/${editId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/coupons', accessToken, {
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
    await adminFetch(`/admin/coupons/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  async function removeSelected() {
    if (!accessToken || selectedCouponIds.length === 0) return;
    const confirmation = `DELETE ${selectedCouponIds.length}`;
    if (!window.confirm(`Permanently delete ${selectedCouponIds.length} selected coupons? This may affect future redemptions.`)) return;
    if (window.prompt(`Type ${confirmation} to confirm this bulk deletion.`) !== confirmation) return;
    setBulkDeleting(true);
    setError(null);
    const results = await Promise.allSettled(
      selectedCouponIds.map((id) =>
        adminFetch(`/admin/coupons/${id}`, accessToken, { method: 'DELETE' }),
      ),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    const deleted = results.length - failed;
    setSelectedCouponIds([]);
    if (failed) setError(`${deleted} deleted; ${failed} could not be deleted.`);
    await load();
    setBulkDeleting(false);
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-3xl">Coupons</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Coupons apply only in the <strong>working market</strong> (sidebar switcher). Use{' '}
            <strong>Copy to market…</strong> to clone a coupon into another window (same code is
            allowed per market).
          </p>
          <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <strong>Percent</strong> — whole-percent off eligible merchandise (1–100).{' '}
              <strong>Fixed</strong> — amount off in minor units; set the currency column(s) that
              match shoppers in this market (USD / TND / AED).
            </li>
            <li>
              <strong>Product scope</strong> — All cart lines, or Include / Exclude by product tags,
              explicit product IDs, “new in last 30 days”, min USD price, and/or min review rating.
            </li>
            <li>
              Optional <strong>min order</strong> (per currency), <strong>max uses</strong> total,
              <strong> max uses per customer</strong>, and <strong>start / end</strong> dates.
            </li>
          </ul>
        </div>
        <Button onClick={openCreate}>New coupon</Button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {selectedCouponIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <p className="text-sm">{selectedCouponIds.length} coupon(s) selected</p>
            <Button variant="destructive" size="sm" disabled={bulkDeleting} onClick={() => void removeSelected()}>
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all coupons"
                  checked={items.length > 0 && items.every((item) => selectedCouponIds.includes(item.id))}
                  onChange={(event) => setSelectedCouponIds(event.target.checked ? items.map((item) => item.id) : [])}
                />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select coupon ${item.code}`}
                    checked={selectedCouponIds.includes(item.id)}
                    onChange={(event) => setSelectedCouponIds((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id))}
                  />
                </TableCell>
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{summarizeDiscount(item)}</Badge>
                </TableCell>
                <TableCell>
                  {item.usedCount}
                  {item.maxUses != null ? ` / ${item.maxUses}` : ''}
                </TableCell>
                <TableCell>{item.isActive ? 'Yes' : 'No'}</TableCell>
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
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No coupons yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {copyMessage ? (
        <p className="text-sm text-muted-foreground">{copyMessage}</p>
      ) : null}

      <ConfirmTypedDialog
        open={!!pendingDelete}
        title="Delete coupon"
        description={
          pendingDelete
            ? `This permanently deletes coupon “${pendingDelete.code}”. Customers will no longer be able to redeem it.`
            : ''
        }
        confirmLabel={typedConfirmToken(pendingDelete?.code, 'DELETE')}
        confirmValue={typedConfirmToken(pendingDelete?.code, 'DELETE')}
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
        entityName={pendingCopy?.code ?? ''}
        entityKind="coupon"
        sourceMarket={market}
        onCancel={() => setPendingCopy(null)}
        onCopy={async (targetMarket) => {
          if (!accessToken || !pendingCopy) {
            throw new Error('Not signed in');
          }
          return adminFetch<CatalogCopyResult>(
            `/admin/coupons/${pendingCopy.id}/copy-to-market`,
            accessToken,
            { method: 'POST', body: JSON.stringify({ targetMarket }) },
          );
        }}
        onCopied={(result) => {
          if (!result.warnings.length) {
            setCopyMessage(`Copied coupon to ${result.targetMarket}`);
          }
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit coupon' : 'New coupon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as CouponType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CouponType.PERCENT}>Percent</SelectItem>
                  <SelectItem value={CouponType.FIXED}>Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Customer description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Shown on the storefront coupons bar"
                maxLength={240}
              />
              <p className="text-xs text-muted-foreground">
                Optional blurb shoppers see next to the code. Coupons stack with loyalty points.
              </p>
            </div>
            {form.type === CouponType.PERCENT ? (
              <div className="space-y-2">
                <Label htmlFor="percentOff">Percent off</Label>
                <Input
                  id="percentOff"
                  type="number"
                  min={1}
                  max={100}
                  value={form.percentOff}
                  onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amountOff">Amount off ({currency}, minor units)</Label>
                <Input
                  id="amountOff"
                  value={form.amountOff}
                  onChange={(e) => setForm((f) => ({ ...f, amountOff: e.target.value }))}
                  placeholder="e.g. 500 = 5.00"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="minSubtotal">Min subtotal ({currency}, minor units)</Label>
              <Input
                id="minSubtotal"
                value={form.minSubtotal}
                onChange={(e) => setForm((f) => ({ ...f, minSubtotal: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max uses (global)</Label>
                <Input
                  id="maxUses"
                  value={form.maxUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPer">Max uses per customer</Label>
                <Input
                  id="maxPer"
                  value={form.maxUsesPerCustomer}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsesPerCustomer: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts at</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Ends at</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Product rules</p>
              <p className="text-xs text-muted-foreground">
                Limit the discount to matching products (include) or skip matching ones (exclude).
                Tags match product catalog tags. Criteria combine with AND when set.
              </p>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={form.productScope}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, productScope: v as CouponProductScope }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CouponProductScope.ALL}>All products</SelectItem>
                    <SelectItem value={CouponProductScope.INCLUDE}>Include matching only</SelectItem>
                    <SelectItem value={CouponProductScope.EXCLUDE}>Exclude matching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.productScope !== CouponProductScope.ALL && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="productTags">Tags (comma-separated)</Label>
                    <Input
                      id="productTags"
                      value={form.productTags}
                      onChange={(e) => setForm((f) => ({ ...f, productTags: e.target.value }))}
                      placeholder="spf, hydrating"
                    />
                    <div className="flex flex-wrap gap-2">
                      {['spf', 'hydrating', 'serum', 'new'].map((tag) => (
                        <Button
                          key={tag}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              productTags: f.productTags
                                ? `${f.productTags}, ${tag}`
                                : tag,
                            }))
                          }
                        >
                          + {tag}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <ProductPicker
                    accessToken={accessToken}
                    value={form.productIds}
                    onChange={(productIds) => setForm((f) => ({ ...f, productIds }))}
                    label="Include / exclude specific products (optional)"
                  />
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={form.ruleIsNew}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, ruleIsNew: checked }))
                      }
                    />
                    <Label>Only new products (last 30 days)</Label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ruleMinPrice">Min price USD (¢)</Label>
                      <Input
                        id="ruleMinPrice"
                        value={form.ruleMinPriceUsd}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, ruleMinPriceUsd: e.target.value }))
                        }
                        placeholder="e.g. 3000 = $30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ruleMinRating">Min rating (stars)</Label>
                      <Input
                        id="ruleMinRating"
                        value={form.ruleMinRating}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, ruleMinRating: e.target.value }))
                        }
                        placeholder="e.g. 4"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          ruleIsNew: true,
                          ruleMinPriceUsd: '',
                          ruleMinRating: '',
                        }))
                      }
                    >
                      Helper: new only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          ruleMinPriceUsd: '3000',
                          ruleIsNew: false,
                        }))
                      }
                    >
                      Helper: price ≥ $30
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          ruleMinRating: '4',
                          ruleIsNew: false,
                        }))
                      }
                    >
                      Helper: 4★+
                    </Button>
                  </div>
                </>
              )}
            </div>

            <FieldError fieldErrors={fieldErrors} field="code" />
            <FieldError fieldErrors={fieldErrors} field="percentOff" />
            <FieldError fieldErrors={fieldErrors} field="endsAt" />
            <FormErrorBanner message={error} />
            <Button onClick={() => void save()} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
