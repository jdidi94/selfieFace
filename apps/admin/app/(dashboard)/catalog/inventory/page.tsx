'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { inventoryAdjustSchema, inventoryTransferSchema } from '@lumea/validation';
import type { InventoryListResponse, InventoryRowDto, WarehouseDto } from '@lumea/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function InventoryPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<InventoryRowDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InventoryRowDto | null>(null);
  const [mode, setMode] = useState<'adjust' | 'transfer'>('adjust');
  const [delta, setDelta] = useState('0');
  const [note, setNote] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    const data = await adminFetch<InventoryListResponse>('/admin/inventory', accessToken);
    setItems(data.items);
    setWarehouses(data.warehouses);
    setThreshold(data.lowStockThreshold);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, market]);

  function openAdjust(item: InventoryRowDto) {
    setSelected(item);
    setMode('adjust');
    setDelta('0');
    setNote('');
    const def =
      warehouses.find((w) => w.isDefault)?.id ??
      item.warehouses.find((w) => w.isDefault)?.warehouseId ??
      warehouses[0]?.id ??
      '';
    setWarehouseId(def);
    setError(null);
  }

  function openTransfer(item: InventoryRowDto) {
    setSelected(item);
    setMode('transfer');
    setTransferQty('1');
    setNote('');
    const active = warehouses.filter((w) => w.isActive);
    setFromWarehouseId(active.find((w) => w.isDefault)?.id ?? active[0]?.id ?? '');
    setToWarehouseId(active.find((w) => !w.isDefault)?.id ?? active[1]?.id ?? '');
    setError(null);
  }

  async function submitAdjust() {
    if (!accessToken || !selected) return;
    setError(null);
    const payload = {
      quantityDelta: Number(delta),
      reason: (Number(delta) >= 0 ? 'RESTOCK' : 'ADJUSTMENT') as 'RESTOCK' | 'ADJUSTMENT',
      note: note || null,
      warehouseId: warehouseId || undefined,
    };
    const validated = validateWithSchema(inventoryAdjustSchema, payload);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    try {
      await adminFetch(`/admin/variants/${selected.id}/inventory`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      });
      setSelected(null);
      await load();
    } catch (err) {
      setError(submitErrorState(err).message);
    }
  }

  async function submitTransfer() {
    if (!accessToken || !selected) return;
    setError(null);
    const payload = {
      variantId: selected.id,
      fromWarehouseId,
      toWarehouseId,
      quantity: Number(transferQty),
      note: note || null,
    };
    const validated = validateWithSchema(inventoryTransferSchema, payload);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    try {
      await adminFetch('/admin/inventory/transfer', accessToken, {
        method: 'POST',
        body: JSON.stringify(validated.data),
      });
      setSelected(null);
      await load();
    } catch (err) {
      setError(submitErrorState(err).message);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  const lowCount = items.filter((item) => item.stock <= threshold).length;
  const activeWarehouses = warehouses.filter((w) => w.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Aggregate stock across active warehouses. Low stock ≤ {threshold}.{' '}
            <Link href="/catalog/warehouses" className="underline underline-offset-2">
              Manage warehouses
            </Link>
          </p>
        </div>
        {lowCount > 0 ? <Badge variant="accent">{lowCount} low stock</Badge> : null}
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>By warehouse</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const low = item.stock <= threshold;
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className={low ? 'text-destructive' : ''}>
                    <span className="inline-flex items-center gap-2">
                      {item.stock}
                      {low ? <Badge variant="outline">Low</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {item.warehouses.length === 0 ? (
                        <span>—</span>
                      ) : (
                        item.warehouses.map((w) => (
                          <Badge key={w.warehouseId} variant="outline">
                            {w.warehouseCode}: {w.quantity}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openAdjust(item)}>
                      Adjust
                    </Button>
                    {activeWarehouses.length >= 2 ? (
                      <Button variant="outline" size="sm" onClick={() => openTransfer(item)}>
                        Transfer
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'adjust' ? 'Adjust stock' : 'Transfer stock'} — {selected?.sku}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mode === 'adjust' ? (
              <>
                <div className="space-y-2">
                  <Label>Warehouse</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
                          {w.isDefault ? ' · default' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity delta (+/-)</Label>
                  <Input value={delta} onChange={(e) => setDelta(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <FormErrorBanner message={error} />
            <Button
              onClick={() => void (mode === 'adjust' ? submitAdjust() : submitTransfer())}
            >
              {mode === 'adjust' ? 'Save adjustment' : 'Transfer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
