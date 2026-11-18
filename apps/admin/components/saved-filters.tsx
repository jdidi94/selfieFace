'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@lumea/ui';
import { useCallback, useEffect, useState } from 'react';

type SavedFilter = {
  id: string;
  name: string;
  entity: string;
  filters: Record<string, string>;
  isShared: boolean;
  ownerUserId: string;
};

export function SavedFilters({
  entity,
  value,
  onApply,
}: {
  entity: 'PRODUCTS' | 'ORDERS' | 'INVENTORY';
  value: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const { accessToken, user } = useAuth();
  const { market } = useAdminMarket();
  const [items, setItems] = useState<SavedFilter[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const rows = await adminFetch<SavedFilter[]>(
        `/admin/saved-filters?entity=${entity}`,
        accessToken,
        { skipCache: true },
      );
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, [accessToken, entity, market]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!accessToken || !name.trim()) return;
    try {
      await adminFetch('/admin/saved-filters', accessToken, {
        method: 'POST',
        body: JSON.stringify({ entity, name: name.trim(), filters: value, isShared: shared }),
      });
      setMessage(shared ? 'Shared view saved.' : 'Private view saved.');
      setName('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this view.');
    }
  }

  async function remove() {
    const item = items.find((row) => row.id === selected);
    if (!accessToken || !item || item.ownerUserId !== user?.id) return;
    try {
      await adminFetch(`/admin/saved-filters/${item.id}`, accessToken, { method: 'DELETE' });
      setSelected('');
      setMessage('Saved view deleted.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this view.');
    }
  }

  const active = items.find((item) => item.id === selected);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-48 flex-1">
        <p className="mb-1 text-xs text-muted-foreground">Saved views · {market}</p>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Choose a saved view" /></SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}{item.isShared ? ' · shared' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" disabled={!active} onClick={() => active && onApply(active.filters)}>
        Apply view
      </Button>
      <Button variant="outline" disabled={!active || active.ownerUserId !== user?.id} onClick={async () => {
        if (!accessToken || !active) return;
        try {
          await adminFetch('/admin/saved-filters', accessToken, {
            method: 'POST',
            body: JSON.stringify({ entity, name: active.name, filters: value, isShared: active.isShared }),
          });
          setMessage('Saved view updated.');
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Could not update this view.');
        }
      }}>Update selected</Button>
      <Button variant="ghost" disabled={!active || active.ownerUserId !== user?.id} onClick={() => void remove()}>
        Delete
      </Button>
      <div className="flex min-w-56 flex-1 gap-2">
        <Input aria-label="Saved view name" placeholder="Name this view" value={name} onChange={(event) => setName(event.target.value)} />
        <Button onClick={() => void save()} disabled={!name.trim()}>Save</Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />
        Share with this market
      </label>
      {message ? <p className="w-full text-xs text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
