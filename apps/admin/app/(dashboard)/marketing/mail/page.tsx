'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { marketingSendSchema } from '@lumea/validation';
import type { MarketingSendResultDto, NewsletterListResponse } from '@lumea/types';
import {
  Badge,
  Button,
  Input,
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
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Audience = 'newsletter' | 'explicit';

export default function MarketingMailPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [audience, setAudience] = useState<Audience>('newsletter');
  const [localeFilter, setLocaleFilter] = useState('all');
  const [toRaw, setToRaw] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [bodyHtml, setBodyHtml] = useState(
    '<p>Hello from Selfieface — a calm note for our newsletter.</p>',
  );
  const [bodyText, setBodyText] = useState('');
  const [subscriberTotal, setSubscriberTotal] = useState<number | null>(null);
  const [sesConfigured, setSesConfigured] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MarketingSendResultDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recentSubs, setRecentSubs] = useState<NewsletterListResponse | null>(null);

  const loadMeta = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    if (localeFilter !== 'all') params.set('locale', localeFilter);
    const count = await adminFetch<{ total: number; sesConfigured: boolean }>(
      `/admin/mail/newsletter/count?${params.toString()}`,
      accessToken,
    );
    setSubscriberTotal(count.total);
    setSesConfigured(count.sesConfigured);

    const list = await adminFetch<NewsletterListResponse>(
      `/admin/mail/newsletter?page=1&pageSize=8&status=SUBSCRIBED${
        localeFilter !== 'all' ? `&locale=${localeFilter}` : ''
      }`,
      accessToken,
    );
    setRecentSubs(list);
  }, [accessToken, localeFilter]);

  useEffect(() => {
    if (!authLoading && accessToken) void loadMeta();
  }, [authLoading, accessToken, loadMeta]);

  function parseRecipients(): string[] {
    return toRaw
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async function runSend(dryRun: boolean) {
    if (!accessToken) return;
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    setResult(null);

    const payload = {
      audience,
      dryRun,
      subject: subject.trim(),
      previewText: previewText.trim() || undefined,
      bodyHtml: bodyHtml.trim(),
      bodyText: bodyText.trim() || undefined,
      ...(audience === 'newsletter' && localeFilter !== 'all'
        ? { locale: localeFilter as 'en' | 'ar' | 'fr' }
        : {}),
      ...(audience === 'explicit' ? { to: parseRecipients() } : {}),
    };

    const validated = validateWithSchema(marketingSendSchema, payload);
    if (!validated.ok) {
      setFormError(validated.message);
      setFieldErrors(validated.fieldErrors);
      setPending(false);
      return;
    }

    try {
      const res = await adminFetch<MarketingSendResultDto>(
        '/admin/mail/marketing',
        accessToken,
        { method: 'POST', body: JSON.stringify(validated.data) },
      );
      setResult(res);
      toast(
        dryRun
          ? `Dry run: ${res.recipientCount} recipient(s)`
          : `Sent ${res.sent} · failed ${res.failed} · skipped ${res.skipped}`,
      );
    } catch (err) {
      const state = submitErrorState(err);
      setFormError(state.message);
      setFieldErrors(state.fieldErrors);
    } finally {
      setPending(false);
    }
  }

  if (authLoading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Marketing mail</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compose a Selfieface-branded broadcast via Amazon SES. Prefer dry-run before sending to
            the full newsletter list.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/marketing/email-logs">Email logs</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="secondary">
          Subscribers: {subscriberTotal == null ? '…' : subscriberTotal}
        </Badge>
        <Badge variant={sesConfigured ? 'default' : 'secondary'}>
          SES: {sesConfigured == null ? '…' : sesConfigured ? 'configured' : 'no-op locally'}
        </Badge>
      </div>

      <FormErrorBanner message={formError} />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select
              value={audience}
              onValueChange={(v) => setAudience(v as Audience)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newsletter">All newsletter subscribers</SelectItem>
                <SelectItem value="explicit">Explicit recipients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === 'newsletter' && (
            <div className="space-y-2">
              <Label>Locale filter</Label>
              <Select value={localeFilter} onValueChange={setLocaleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locales</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {audience === 'explicit' && (
            <div className="space-y-2">
              <Label htmlFor="to">Recipients (one per line, max 50)</Label>
              <Textarea
                id="to"
                rows={4}
                value={toRaw}
                onChange={(e) => setToRaw(e.target.value)}
                placeholder="guest@example.com"
              />
              <FieldError fieldErrors={fieldErrors} field="to" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
            <FieldError fieldErrors={fieldErrors} field="subject" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preview">Preview text</Label>
            <Input
              id="preview"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyHtml">HTML body</Label>
            <Textarea
              id="bodyHtml"
              rows={10}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
            <FieldError fieldErrors={fieldErrors} field="bodyHtml" />
            <p className="text-xs text-muted-foreground">
              Wrapped in the Selfieface mail layout (plum accent #381F43). Newsletter sends include
              an unsubscribe link automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyText">Plain text (optional)</Label>
            <Textarea
              id="bodyText"
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void runSend(true)}
            >
              Dry-run preview
            </Button>
            <Button type="button" disabled={pending} onClick={() => void runSend(false)}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {result && (
            <div className="rounded-md border border-border p-4 text-sm">
              <p className="font-medium">Send result</p>
              <ul className="mt-3 space-y-1 text-muted-foreground">
                <li>Audience: {result.audience}</li>
                <li>Recipients: {result.recipientCount}</li>
                <li>Dry run: {result.dryRun ? 'yes' : 'no'}</li>
                <li>Sent: {result.sent}</li>
                <li>Failed: {result.failed}</li>
                <li>Skipped: {result.skipped}</li>
                {result.skippedReason ? <li>Last skip: {result.skippedReason}</li> : null}
                {result.previewRecipients?.length ? (
                  <li>
                    Preview: {result.previewRecipients.join(', ')}
                    {result.recipientCount > result.previewRecipients.length ? '…' : ''}
                  </li>
                ) : null}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-border p-4">
            <p className="text-sm font-medium">Recent subscribers</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {(recentSubs?.items ?? []).length === 0 ? (
                <li>No active subscribers yet.</li>
              ) : (
                recentSubs?.items.map((s) => (
                  <li key={s.id}>
                    {s.email}
                    {s.locale ? ` · ${s.locale}` : ''}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
