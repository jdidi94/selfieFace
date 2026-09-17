'use client';

import { fetchApi } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { NewsletterUnsubscribeResponse } from '@lumea/types';
import { Button } from '@lumea/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    email && token ? 'pending' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchApi<NewsletterUnsubscribeResponse>('/newsletter/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ email, token }),
        });
        if (cancelled) return;
        setStatus('success');
        setMessage(
          res.alreadyUnsubscribed ? t.newsletterUnsubAlready : t.newsletterUnsubSuccess,
        );
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t.newsletterUnsubError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    email,
    token,
    t.newsletterUnsubAlready,
    t.newsletterUnsubSuccess,
    t.newsletterUnsubError,
  ]);

  if (!email || !token) {
    return <p className="text-muted-foreground">{t.newsletterUnsubMissing}</p>;
  }

  return (
    <div className="space-y-4">
      {status === 'pending' && <p className="text-muted-foreground">{t.newsletterUnsubPending}</p>}
      {status === 'success' && <p className="text-foreground">{message}</p>}
      {status === 'error' && <p className="text-destructive">{message}</p>}
      <Button asChild variant="outline">
        <Link href="/shop">{t.footerShop}</Link>
      </Button>
    </div>
  );
}

export default function NewsletterUnsubscribePage() {
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display mb-2 text-4xl">{t.newsletterUnsubTitle}</h1>
      <p className="mb-8 text-muted-foreground">{t.newsletterUnsubSubtitle}</p>
      <Suspense fallback={<p className="text-muted-foreground">{t.loading}</p>}>
        <UnsubscribeInner />
      </Suspense>
    </div>
  );
}
