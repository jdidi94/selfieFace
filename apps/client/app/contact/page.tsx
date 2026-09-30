'use client';

import { LocaleLink } from '@/components/locale-link';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { marketFromCurrency } from '@/lib/market-path';
import { getMessages } from '@/lib/messages';
import { supportTicketStatusLabel } from '@/lib/order-labels';
import {
  SupportTicketTopic,
  type SupportTicketCreateResult,
  type SupportTicketLookupDto,
} from '@lumea/types';
import { Button, Input, Label, Textarea } from '@lumea/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const TOPICS = [
  SupportTicketTopic.REFUND,
  SupportTicketTopic.WEBSITE,
  SupportTicketTopic.ORDER,
  SupportTicketTopic.OTHER,
] as const;

function ContactInner() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const market = marketFromCurrency(currency);
  const { user, accessToken } = useAuth();
  const t = getMessages(locale);

  const [topic, setTopic] = useState<SupportTicketTopic>(SupportTicketTopic.OTHER);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<SupportTicketLookupDto | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const [myTickets, setMyTickets] = useState<SupportTicketLookupDto[]>([]);

  useEffect(() => {
    const topicParam = searchParams.get('topic');
    if (
      topicParam &&
      (TOPICS as readonly string[]).includes(topicParam)
    ) {
      setTopic(topicParam as SupportTicketTopic);
    }
    const orderParam = searchParams.get('orderNumber');
    if (orderParam) setOrderNumber(orderParam);
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setLookupEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    setEmail((prev) => prev || user.email);
    setLookupEmail((prev) => prev || user.email);
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (full) setName((prev) => prev || full);
  }, [user]);

  useEffect(() => {
    if (!accessToken) {
      setMyTickets([]);
      return;
    }
    void fetch(`${apiUrl}/support/tickets/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        setMyTickets((await res.json()) as SupportTicketLookupDto[]);
      })
      .catch(() => setMyTickets([]));
  }, [accessToken]);

  const topicLabel = (value: SupportTicketTopic) => {
    switch (value) {
      case SupportTicketTopic.REFUND:
        return t.contactTopicRefund;
      case SupportTicketTopic.WEBSITE:
        return t.contactTopicWebsite;
      case SupportTicketTopic.ORDER:
        return t.contactTopicOrder;
      default:
        return t.contactTopicOther;
    }
  };

  async function uploadFiles(): Promise<string[]> {
    const ids: string[] = [];
    for (const file of files.slice(0, 5)) {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${apiUrl}/support/media`, { method: 'POST', body });
      if (!res.ok) throw new Error(t.contactUploadError);
      const media = (await res.json()) as { id: string };
      ids.push(media.id);
    }
    return ids;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);
    setSuccessStatus(null);
    setSubmitting(true);
    try {
      const mediaIds = await uploadFiles();
      const res = await fetch(`${apiUrl}/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          subject: subject.trim(),
          message: message.trim(),
          name: name.trim() || null,
          email: email.trim(),
          locale,
          market,
          currency,
          orderNumber: orderNumber.trim() || null,
          mediaIds: mediaIds.length ? mediaIds : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(t.contactError);
      }
      const created = (await res.json()) as SupportTicketCreateResult;
      const submittedSubject = subject.trim();
      setSuccessId(created.id);
      setSuccessStatus(created.status);
      setSubject('');
      setMessage('');
      setOrderNumber('');
      setFiles([]);
      if (accessToken) {
        setMyTickets((prev) => [
          {
            id: created.id,
            status: created.status,
            subject: submittedSubject || created.id,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.contactError);
    } finally {
      setSubmitting(false);
    }
  }

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    setLookupPending(true);
    try {
      const res = await fetch(`${apiUrl}/support/tickets/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lookupId.trim(),
          email: lookupEmail.trim(),
        }),
      });
      if (!res.ok) {
        throw new Error(t.contactLookupNotFound);
      }
      setLookupResult((await res.json()) as SupportTicketLookupDto);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : t.contactLookupNotFound);
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-xl space-y-12">
        <div>
          <h1 className="font-display mb-2 text-4xl md:text-5xl">{t.contactTitle}</h1>
          <p className="mb-8 text-muted-foreground">{t.contactSubtitle}</p>
          <p className="mb-8 text-sm">
            <LocaleLink href="/help" className="underline underline-offset-2">
              {t.contactFaqLink}
            </LocaleLink>
          </p>

          {successId ? (
            <div className="mb-6 space-y-2 rounded-md border border-border bg-surface-muted/50 px-4 py-3 text-sm">
              <p className="font-medium">{t.contactSuccessTitle}</p>
              <p>{t.contactSuccess}</p>
              <p>
                <span className="text-muted-foreground">{t.contactTicketReference}: </span>
                <code className="font-mono text-foreground">{successId}</code>
              </p>
              {successStatus ? (
                <p>
                  <span className="text-muted-foreground">{t.contactTicketStatusLabel}: </span>
                  {supportTicketStatusLabel(successStatus, t)}
                </p>
              ) : null}
              <p className="text-muted-foreground">{t.contactSaveReference}</p>
              <LocaleLink href="/help" className="underline underline-offset-2">
                {t.contactSuccessHelpLink}
              </LocaleLink>
            </div>
          ) : null}
          {error ? (
            <p className="mb-6 rounded-md border border-destructive/40 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic">{t.contactTopicLabel}</Label>
              <select
                id="topic"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={topic}
                onChange={(e) => setTopic(e.target.value as SupportTicketTopic)}
              >
                {TOPICS.map((value) => (
                  <option key={value} value={value}>
                    {topicLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">{t.contactSubjectLabel}</Label>
              <Input
                id="subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">{t.contactMessageLabel}</Label>
              <Textarea
                id="message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={10}
                maxLength={5000}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t.contactNameLabel}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.contactEmailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">{t.contactOrderLabel}</Label>
              <Input
                id="order"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="files">{t.contactAttachmentsLabel}</Label>
              <Input
                id="files"
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
              {files.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {files.map((f) => f.name).join(', ')}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? t.contactSending : t.contactSubmit}
            </Button>
          </form>
        </div>

        <section className="border-t border-border pt-10">
          <h2 className="font-display mb-4 text-2xl">{t.contactLookupTitle}</h2>
          <form onSubmit={(e) => void onLookup(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lookupId">{t.contactLookupId}</Label>
              <Input
                id="lookupId"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookupEmail">{t.contactEmailLabel}</Label>
              <Input
                id="lookupEmail"
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={lookupPending}>
              {lookupPending ? t.loading : t.contactLookupSubmit}
            </Button>
          </form>
          {lookupError ? (
            <p className="mt-3 text-sm text-destructive">{lookupError}</p>
          ) : null}
          {lookupResult ? (
            <div className="mt-4 rounded-md border border-border px-4 py-3 text-sm">
              <p className="font-medium">{lookupResult.subject}</p>
              <p className="mt-1 text-muted-foreground">
                {t.contactTicketReference}:{' '}
                <code className="font-mono text-foreground">{lookupResult.id}</code>
              </p>
              <p className="mt-1">
                {t.contactTicketStatusLabel}:{' '}
                {supportTicketStatusLabel(lookupResult.status, t)}
              </p>
            </div>
          ) : null}
        </section>

        {user && myTickets.length > 0 ? (
          <section className="border-t border-border pt-10">
            <h2 className="font-display mb-4 text-2xl">{t.contactMyTickets}</h2>
            <ul className="divide-y divide-border">
              {myTickets.map((ticket) => (
                <li key={ticket.id} className="py-3 text-sm">
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="mt-1 text-muted-foreground">
                    <code className="font-mono">{ticket.id}</code>
                    {' · '}
                    {supportTicketStatusLabel(ticket.status, t)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<main className="px-6 py-12" />}>
      <ContactInner />
    </Suspense>
  );
}
