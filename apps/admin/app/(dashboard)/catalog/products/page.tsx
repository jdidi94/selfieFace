'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import type { ProductListResponse } from '@lumea/types';
import { productBulkTagsSchema } from '@lumea/validation';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Input,
  Label,
  LoadingState,
  Pagination,
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
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminProductsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
    });
    if (search.trim()) params.set('q', search.trim());
    if (status !== 'all') params.set('status', status);
    try {
      const result = await adminFetch<ProductListResponse>(
        `/admin/products?${params.toString()}`,
        accessToken,
      );
      setData(result);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status, market]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
  const allPageSelected = useMemo(
    () => items.length > 0 && items.every((item) => selected.has(item.id)),
    [items, selected],
  );

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((item) => item.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function runBulk(mode: 'add' | 'remove') {
    if (!accessToken) return;
    const tags = parseTagInput(tagInput);
    if (!tags.length || selected.size === 0) {
      setBulkMessage('Select products and enter at least one tag');
      return;
    }
    setBulkPending(true);
    setBulkMessage(null);
    setError(null);
    const payload =
      mode === 'add'
        ? { productIds: [...selected], add: tags }
        : { productIds: [...selected], remove: tags };
    const validated = validateWithSchema(productBulkTagsSchema, payload);
    if (!validated.ok) {
      setBulkMessage(validated.message);
      setBulkPending(false);
      return;
    }
    try {
      const result = await adminFetch<{ updated: number }>(
        '/admin/products/bulk-tags',
        accessToken,
        { method: 'POST', body: JSON.stringify(validated.data) },
      );
      setBulkMessage(
        mode === 'add'
          ? `Added tags on ${result.updated} products`
          : `Removed tags from ${result.updated} products`,
      );
      setTagInput('');
      await load();
    } catch (err) {
      setBulkMessage(submitErrorState(err).message);
    } finally {
      setBulkPending(false);
    }
  }

  if (authLoading) return <LoadingState label="Loading products…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Products</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} products` : 'Manage catalog products and variants.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/catalog/products/new">Add product</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            placeholder="Search name, slug, SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setSearch(q);
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            setSearch(q);
          }}
        >
          Search
        </Button>
        <div className="min-w-[160px]">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="bulk-tags">Tags for {selected.size} selected</Label>
            <Input
              id="bulk-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Comma-separated tags…"
              disabled={bulkPending}
            />
          </div>
          <Button disabled={bulkPending} onClick={() => void runBulk('add')}>
            Add tags
          </Button>
          <Button
            variant="outline"
            disabled={bulkPending}
            onClick={() => void runBulk('remove')}
          >
            Remove tags
          </Button>
          <Button
            variant="ghost"
            disabled={bulkPending}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
          {bulkMessage ? (
            <p className="w-full text-sm text-muted-foreground">{bulkMessage}</p>
          ) : null}
        </div>
      ) : null}

      <FormErrorBanner message={error} />

      {loading ? (
        <LoadingState label="Loading products…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different search or create a new product."
          action={
            <Button asChild>
              <Link href="/catalog/products/new">Add product</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={(v) => toggleOne(item.id, v === true)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(item.tags ?? []).slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {(item.tags?.length ?? 0) > 4 ? (
                          <span className="text-xs text-muted-foreground">
                            +{(item.tags?.length ?? 0) - 4}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.category.name}</TableCell>
                    <TableCell>
                      {item.currency} {(item.priceFrom / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/catalog/products/${item.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
