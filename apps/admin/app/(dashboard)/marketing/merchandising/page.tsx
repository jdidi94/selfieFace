'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { ProductPicker, type PickedProduct } from '@/components/product-picker';
import { adminFetch } from '@/lib/api';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { merchandisingRailReplaceSchema } from '@lumea/validation';
import { useAuth } from '@/lib/auth-context';
import {
  MerchandisingRailKind,
  type MerchandisingRailItemDto,
  type MerchandisingRailsAdminDto,
  type SearchInsightDto,
} from '@lumea/types';
import {
  Badge,
  Button,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { useEffect, useMemo, useState } from 'react';
import { useAdminMarket } from '@/lib/market-context';

const RAILS: { kind: MerchandisingRailKind; label: string; hint: string }[] = [
  {
    kind: MerchandisingRailKind.TOP,
    label: 'Top products',
    hint: 'Empty = auto-rank by popularity score (behavior clicks).',
  },
  {
    kind: MerchandisingRailKind.NEW,
    label: 'New products',
    hint: 'Empty = auto-rank by newest createdAt.',
  },
  {
    kind: MerchandisingRailKind.INCOMING,
    label: 'Incoming products',
    hint: 'Empty = products marked Incoming. Curate to pin a set.',
  },
  {
    kind: MerchandisingRailKind.TOP_PACKS,
    label: 'Top packs',
    hint: 'Empty = auto-rank active packs by popularity. Prefer pack products.',
  },
];

export default function MerchandisingPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [rails, setRails] = useState<MerchandisingRailsAdminDto | null>(null);
  const [insights, setInsights] = useState<SearchInsightDto[]>([]);
  const [drafts, setDrafts] = useState<Record<MerchandisingRailKind, string[]>>({
    [MerchandisingRailKind.TOP]: [],
    [MerchandisingRailKind.NEW]: [],
    [MerchandisingRailKind.INCOMING]: [],
    [MerchandisingRailKind.TOP_PACKS]: [],
  });
  const [pendingRail, setPendingRail] = useState<MerchandisingRailKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedMetaByKind = useMemo(() => {
    const empty: Record<MerchandisingRailKind, PickedProduct[]> = {
      [MerchandisingRailKind.TOP]: [],
      [MerchandisingRailKind.NEW]: [],
      [MerchandisingRailKind.INCOMING]: [],
      [MerchandisingRailKind.TOP_PACKS]: [],
    };
    if (!rails) return empty;
    for (const kind of Object.values(MerchandisingRailKind)) {
      const items =
        kind === MerchandisingRailKind.TOP
          ? rails.top
          : kind === MerchandisingRailKind.NEW
            ? rails.new
            : kind === MerchandisingRailKind.TOP_PACKS
              ? rails.topPacks
              : rails.incoming;
      empty[kind] = items.map((r) => ({
        id: r.productId,
        name: r.product?.name ?? r.productId,
        slug: r.product?.slug ?? '',
      }));
    }
    return empty;
  }, [rails]);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [railData, search] = await Promise.all([
        adminFetch<MerchandisingRailsAdminDto>('/admin/merchandising/rails', accessToken),
        adminFetch<SearchInsightDto[]>('/admin/merchandising/search-insights?limit=25', accessToken).catch(
          () => [] as SearchInsightDto[],
        ),
      ]);
      setRails(railData);
      setInsights(search);
      setDrafts({
        [MerchandisingRailKind.TOP]: railData.top.map((r) => r.productId),
        [MerchandisingRailKind.NEW]: railData.new.map((r) => r.productId),
        [MerchandisingRailKind.INCOMING]: railData.incoming.map((r) => r.productId),
        [MerchandisingRailKind.TOP_PACKS]: (railData.topPacks ?? []).map((r) => r.productId),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void load();
  }, [accessToken, authLoading, market]);

  function curatedFor(kind: MerchandisingRailKind): MerchandisingRailItemDto[] {
    if (!rails) return [];
    if (kind === MerchandisingRailKind.TOP) return rails.top;
    if (kind === MerchandisingRailKind.NEW) return rails.new;
    if (kind === MerchandisingRailKind.TOP_PACKS) return rails.topPacks ?? [];
    return rails.incoming;
  }

  async function saveRail(kind: MerchandisingRailKind) {
    if (!accessToken) {
      setError('You must be signed in to save merchandising');
      return;
    }
    setPendingRail(kind);
    setError(null);
    const payload = { productIds: drafts[kind] };
    const validated = validateWithSchema(merchandisingRailReplaceSchema, payload);
    if (!validated.ok) {
      setError(validated.message);
      setPendingRail(null);
      return;
    }
    try {
      await adminFetch(`/admin/merchandising/rails/${kind}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify(validated.data),
      });
      await load();
    } catch (e) {
      setError(submitErrorState(e).message);
    } finally {
      setPendingRail(null);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="font-display text-3xl">Homepage merchandising</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Curate Top / New / Incoming / Top packs rails, or leave a rail empty to use auto-ranking.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {RAILS.map((rail) => {
        const curated = curatedFor(rail.kind);
        return (
          <section key={rail.kind} className="space-y-4 rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{rail.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{rail.hint}</p>
                {curated.length === 0 ? (
                  <Badge variant="secondary" className="mt-2">
                    Auto-rank active
                  </Badge>
                ) : (
                  <Badge className="mt-2">Curated ({curated.length})</Badge>
                )}
              </div>
              <Button
                type="button"
                onClick={() => void saveRail(rail.kind)}
                disabled={pendingRail === rail.kind}
              >
                {pendingRail === rail.kind ? 'Saving…' : 'Save rail'}
              </Button>
            </div>

            <ProductPicker
              accessToken={accessToken}
              value={drafts[rail.kind]}
              onChange={(productIds) =>
                setDrafts((prev) => ({ ...prev, [rail.kind]: productIds }))
              }
              selectedMeta={selectedMetaByKind[rail.kind]}
              label="Curated products"
              max={24}
              disabled={pendingRail === rail.kind}
            />
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Search insights</h2>
        <p className="text-sm text-muted-foreground">
          Aggregated from deferred behavior batches (search queries flushed on leave).
        </p>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No search insights yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Locale</TableHead>
                <TableHead>Hits</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.map((row) => (
                <TableRow key={`${row.query}-${row.locale}`}>
                  <TableCell>{row.query}</TableCell>
                  <TableCell>{row.locale}</TableCell>
                  <TableCell>{row.hitCount}</TableCell>
                  <TableCell>{new Date(row.lastSeenAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
