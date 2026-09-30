'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import type { LegalDocumentDto } from '@lumea/types';
import { Button, Label, LoadingState, Textarea } from '@lumea/ui';
import { useEffect, useState } from 'react';

const SLUGS = ['privacy', 'terms', 'cookies', 'shipping', 'returns'] as const;
const DEFAULT_TITLES: Record<(typeof SLUGS)[number], string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
  shipping: 'Shipping Policy',
  returns: 'Returns & Exchanges',
};
const LOCALES = ['en', 'ar', 'fr'] as const;

export default function PoliciesPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [documents, setDocuments] = useState<LegalDocumentDto[]>([]);
  const [slug, setSlug] = useState<(typeof SLUGS)[number]>('terms');
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>('en');
  const [title, setTitle] = useState(DEFAULT_TITLES.terms);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    setLoading(true);
    void adminFetch<LegalDocumentDto[]>('/admin/legal-documents', accessToken, {
      skipCache: true,
    })
      .then(setDocuments)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load policies'))
      .finally(() => setLoading(false));
  }, [accessToken, authLoading, market]);

  useEffect(() => {
    const selected = documents.find((item) => item.slug === slug && item.locale === locale);
    setTitle(selected?.title ?? DEFAULT_TITLES[slug]);
    setContent(selected?.content ?? '');
  }, [documents, slug, locale]);

  async function save() {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await adminFetch<LegalDocumentDto>('/admin/legal-documents', accessToken, {
        method: 'POST',
        body: JSON.stringify({ slug, locale, title, content }),
      });
      setDocuments((current) => [
        ...current.filter((item) => !(item.slug === slug && item.locale === locale)),
        saved,
      ]);
      setMessage('Policy saved. It is now live on the storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save policy');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Policies and rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the legal pages and checkout policy details for {market}. Text is shown as plain text on the storefront.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="policy-page">Policy</Label>
          <select
            id="policy-page"
            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
            value={slug}
            onChange={(event) => setSlug(event.target.value as (typeof SLUGS)[number])}
          >
            {SLUGS.map((item) => (
              <option key={item} value={item}>{DEFAULT_TITLES[item]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="policy-locale">Language</Label>
          <select
            id="policy-locale"
            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
            value={locale}
            onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number])}
          >
            {LOCALES.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-title">Page title</Label>
        <input
          id="policy-title"
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-content">Policy text</Label>
        <Textarea
          id="policy-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={20}
          maxLength={40_000}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          placeholder="Write headings and paragraphs as plain text, using a blank line between sections."
        />
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}
      <Button onClick={() => void save()} disabled={saving || !title.trim() || !content.trim()}>
        {saving ? 'Saving…' : 'Save policy'}
      </Button>
    </div>
  );
}
