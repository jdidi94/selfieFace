'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { EmailLogListResponse } from '@lumea/types';
import {
  Badge,
  Button,
  Input,
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
import { useCallback, useEffect, useState } from 'react';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SKIPPED', label: 'Skipped' },
];

const TEMPLATE_OPTIONS = [
  { value: 'all', label: 'All templates' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'NEWSLETTER_WELCOME', label: 'Newsletter welcome' },
  { value: 'ORDER_CONFIRMATION', label: 'Order confirmation' },
  { value: 'ORDER_SHIPPED', label: 'Order shipped' },
  { value: 'ORDER_DELIVERED', label: 'Order delivered' },
  { value: 'ORDER_CANCELLED', label: 'Order cancelled' },
  { value: 'EMAIL_VERIFICATION', label: 'Email verification' },
  { value: 'PASSWORD_RESET', label: 'Password reset' },
  { value: 'ACCOUNT_BLOCKED', label: 'Account blocked' },
  { value: 'ACCOUNT_UNBLOCKED', label: 'Account unblocked' },
  { value: 'RESTOCK', label: 'Restock' },
  { value: 'ADMIN_ORDER_NOTIFY', label: 'Admin order notify' },
  { value: 'ADMIN_LOW_STOCK', label: 'Admin low stock' },
];

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'SENT') return 'default';
  if (status === 'FAILED') return 'outline';
  return 'secondary';
}

export default function EmailLogsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<EmailLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [templateType, setTemplateType] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status,
    });
    if (templateType !== 'all') params.set('templateType', templateType);
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<EmailLogListResponse>(
      `/admin/mail/logs?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setLoading(false);
  }, [accessToken, page, status, templateType, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (authLoading || (loading && !data)) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Email logs</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Read-only audit of outbound mail (sent, skipped when SES is unset, and failures).
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/marketing/mail">Compose mail</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1);
              setStatus(value);
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
        <div className="min-w-[200px]">
          <Select
            value={templateType}
            onValueChange={(value) => {
              setPage(1);
              setTemplateType(value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search to, subject, message id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            setSearch(q);
          }}
        >
          Search
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider / error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No email logs yet.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{row.to}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm">{row.subject}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.templateType}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(String(row.status))}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {row.providerMessageId || row.error || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * data.pageSize + (data.items.length ? 1 : 0)}–
            {(page - 1) * data.pageSize + data.items.length} of {data.total}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
