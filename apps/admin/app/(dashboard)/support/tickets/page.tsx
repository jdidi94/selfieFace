'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Input,
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
import {
  SupportTicketStatus,
  SupportTicketTopic,
  type AdminSupportTicketListResponse,
} from '@lumea/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: SupportTicketStatus.OPEN, label: 'Open' },
  { value: SupportTicketStatus.IN_PROGRESS, label: 'In progress' },
  { value: SupportTicketStatus.CLOSED, label: 'Closed' },
];

const TOPIC_OPTIONS = [
  { value: 'all', label: 'All topics' },
  { value: SupportTicketTopic.REFUND, label: 'Refund' },
  { value: SupportTicketTopic.WEBSITE, label: 'Website' },
  { value: SupportTicketTopic.ORDER, label: 'Order' },
  { value: SupportTicketTopic.OTHER, label: 'Other' },
];

function statusVariant(
  status: SupportTicketStatus,
): 'default' | 'secondary' | 'outline' | 'accent' {
  if (status === SupportTicketStatus.CLOSED) return 'secondary';
  if (status === SupportTicketStatus.IN_PROGRESS) return 'outline';
  return 'accent';
}

export default function TicketsListPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminSupportTicketListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('OPEN');
  const [topic, setTopic] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status !== 'all') params.set('status', status);
    if (topic !== 'all') params.set('topic', topic);
    if (search.trim()) params.set('q', search.trim());
    const result = await adminFetch<AdminSupportTicketListResponse>(
      `/admin/tickets?${params.toString()}`,
      accessToken,
      { skipCache: true },
    );
    setData(result);
    setLoading(false);
  }, [accessToken, status, topic, search]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Support tickets</h1>
        <p className="text-sm text-muted-foreground">
          Customer service inbox for the current market.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Select value={status} onValueChange={setStatus}>
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
        <div className="min-w-[160px]">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPIC_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search subject, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={() => setSearch(q)}>
          Search
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="max-w-xs truncate font-medium">{ticket.subject}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ticket.topic}</Badge>
                </TableCell>
                <TableCell className="text-sm">{ticket.email}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/support/tickets/${ticket.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No tickets match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
