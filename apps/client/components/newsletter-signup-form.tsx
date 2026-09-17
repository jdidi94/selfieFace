'use client';

import { fetchApi } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { NewsletterSubscribeResponse } from '@lumea/types';
import { Button, Input } from '@lumea/ui';
import { useState } from 'react';

export function NewsletterSignupForm({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetchApi<NewsletterSubscribeResponse>('/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          locale,
          source: 'footer',
        }),
      });
      setDone(true);
      setAlready(Boolean(res.alreadySubscribed));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.newsletterError);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        {already ? t.newsletterAlready : t.newsletterSuccess}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={compact ? 'space-y-2' : 'mt-1 space-y-2'}
    >
      <p className="text-sm text-muted-foreground">{t.newsletterPrompt}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email}
          aria-label={t.email}
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={pending} className="shrink-0">
          {pending ? t.newsletterSubmitting : t.newsletterCta}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
