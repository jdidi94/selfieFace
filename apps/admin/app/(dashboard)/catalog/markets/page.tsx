'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { marketLabel, useAdminMarket } from '@/lib/market-context';
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import type { MarketDto } from '@lumea/types';
import { useCallback, useEffect, useState } from 'react';

export default function MarketsAdminPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market: activeMarket, setMarket } = useAdminMarket();
  const [rows, setRows] = useState<MarketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<MarketDto | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<MarketDto[]>('/admin/markets', accessToken, {
        skipCache: true,
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  async function toggleEnabled(row: MarketDto, enabled: boolean) {
    if (!accessToken) return;
    setSaving(row.code);
    try {
      const updated = await adminFetch<MarketDto>(`/admin/markets/${row.code}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setRows((prev) => prev.map((r) => (r.code === updated.code ? updated : r)));
      setPendingDisable(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update market');
    } finally {
      setSaving(null);
    }
  }

  function onEnabledChange(row: MarketDto, enabled: boolean) {
    if (enabled) {
      void toggleEnabled(row, true);
      return;
    }
    setPendingDisable(row);
  }

  if (authLoading || loading) return <LoadingState label="Loading markets…" />;
  if (error && !rows.length) return <EmptyState title="Markets unavailable" description={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Market windows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable Emirates, Tunisia, and rest-of-world storefronts. Catalog and settings
          stay separate — there is no copy between windows.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.code}>
              <TableCell className="font-medium">{marketLabel(row.code)}</TableCell>
              <TableCell>{row.currency}</TableCell>
              <TableCell>
                <Badge variant={row.enabled ? 'secondary' : 'outline'}>
                  {row.enabled ? 'Live' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={row.enabled}
                  disabled={saving === row.code}
                  onCheckedChange={(checked) => onEnabledChange(row, checked)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={activeMarket === row.code ? 'primary' : 'outline'}
                  onClick={() => setMarket(row.code)}
                >
                  {activeMarket === row.code ? 'Working here' : 'Work in this window'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmTypedDialog
        open={!!pendingDisable}
        title="Disable market"
        description={
          pendingDisable
            ? `Disable ${marketLabel(pendingDisable.code)}? The storefront for this window will stop serving shoppers.`
            : ''
        }
        confirmLabel={typedConfirmToken(
          pendingDisable ? marketLabel(pendingDisable.code) : null,
          'DISABLE',
        )}
        confirmValue={typedConfirmToken(
          pendingDisable ? marketLabel(pendingDisable.code) : null,
          'DISABLE',
        )}
        confirmButtonLabel="Disable"
        onCancel={() => setPendingDisable(null)}
        onConfirm={async () => {
          if (!pendingDisable) return;
          await toggleEnabled(pendingDisable, false);
        }}
      />
    </div>
  );
}
