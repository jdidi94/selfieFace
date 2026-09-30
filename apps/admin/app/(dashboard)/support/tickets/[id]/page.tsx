'use client';

import { adminFetch, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@lumea/ui';
import {
  SupportTicketStatus,
  type SupportTicketDto,
} from '@lumea/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState<SupportTicketDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SupportTicketStatus>(SupportTicketStatus.OPEN);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const data = await adminFetch<SupportTicketDto>(`/admin/tickets/${id}`, accessToken, {
        skipCache: true,
      });
      setTicket(data);
      setStatus(data.status);
      setNotes(data.adminNotes ?? '');
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  async function save() {
    if (!accessToken || !id) return;
    setSaving(true);
    try {
      const updated = await adminFetch<SupportTicketDto>(`/admin/tickets/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes: notes.trim() || null }),
      });
      setTicket(updated);
      toast('Ticket updated');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;
  if (!ticket) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Ticket not found.</p>
        <Button asChild variant="outline">
          <Link href="/support/tickets">Back to inbox</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ms-2 mb-2">
            <Link href="/support/tickets">← Inbox</Link>
          </Button>
          <h1 className="font-display text-3xl">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ticket.topic} · {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">{ticket.status}</Badge>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Contact
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd>{ticket.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{ticket.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Locale</dt>
            <dd>{ticket.locale}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Customer</dt>
            <dd>
              {ticket.customerId ? (
                <Link
                  href={`/customers/${ticket.customerId}`}
                  className="underline underline-offset-2"
                >
                  {ticket.customerEmail || ticket.customerId}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order</dt>
            <dd>
              {ticket.orderId ? (
                <Link href={`/orders/${ticket.orderId}`} className="underline underline-offset-2">
                  {ticket.orderDisplayNumber || ticket.orderId}
                </Link>
              ) : ticket.orderNumber ? (
                ticket.orderNumber
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Message
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.message}</p>
        {ticket.attachments.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {ticket.attachments.map((att) => {
              const url = mediaUrl(att.url);
              const isImage = att.mimeType?.startsWith('image/');
              return (
                <li key={att.id}>
                  <a
                    href={url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded border border-border"
                  >
                    {isImage && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={att.filename ?? 'Attachment'} className="h-28 w-28 object-cover" />
                    ) : (
                      <span className="block max-w-[10rem] truncate px-3 py-2 text-xs">
                        {att.filename || att.mediaId}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Admin
        </h2>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as SupportTicketStatus)}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SupportTicketStatus.OPEN}>Open</SelectItem>
              <SelectItem value={SupportTicketStatus.IN_PROGRESS}>In progress</SelectItem>
              <SelectItem value={SupportTicketStatus.CLOSED}>Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Internal notes</Label>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </section>
    </div>
  );
}
