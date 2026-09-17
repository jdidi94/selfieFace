'use client';

import { Button, cn } from '@lumea/ui';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const { accessToken, refreshSession } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    token ? 'pending' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(data.message ?? t.verifyEmailInvalid);
          return;
        }
        setStatus('success');
        setMessage(data.message ?? t.verifyEmailSuccess);
        if (accessToken) {
          await refreshSession();
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage(t.verifyEmailInvalid);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, accessToken, refreshSession, t.verifyEmailInvalid, t.verifyEmailSuccess]);

  async function resend() {
    setResendPending(true);
    setResendMessage(null);
    try {
      if (accessToken) {
        const data = await authFetch<{ message: string }>(
          '/auth/resend-verification/me',
          accessToken,
          { method: 'POST', body: '{}' },
        );
        setResendMessage(data.message);
      } else {
        setResendMessage(t.verifyEmailResendNeedSignIn);
      }
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : t.somethingWentWrong);
    } finally {
      setResendPending(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t.verifyEmailMissingToken}</p>
        <Button asChild className={cn(bannerCtaPrimaryClassName)}>
          <Link href="/account">{t.backToAccount}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === 'pending' && <p className="text-muted-foreground">{t.verifyEmailPending}</p>}
      {status === 'success' && (
        <>
          <p className="text-foreground">{message}</p>
          <Button
            type="button"
            className={cn('w-full', bannerCtaPrimaryClassName)}
            onClick={() => router.push('/account')}
          >
            {t.backToAccount}
          </Button>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-destructive">{message}</p>
          <Button
            type="button"
            disabled={resendPending || !accessToken}
            className={cn('w-full', bannerCtaPrimaryClassName)}
            onClick={() => void resend()}
          >
            {resendPending ? t.pleaseWait : t.verifyEmailResend}
          </Button>
          {resendMessage && <p className="text-sm text-muted-foreground">{resendMessage}</p>}
          {!accessToken && (
            <p className="text-sm text-muted-foreground">
              <Link href="/account/login" className="underline">
                {t.signIn}
              </Link>{' '}
              {t.verifyEmailResendNeedSignInHint}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display mb-2 text-4xl">{t.verifyEmailTitle}</h1>
      <p className="mb-8 text-muted-foreground">{t.verifyEmailSubtitle}</p>
      <Suspense fallback={<p className="text-muted-foreground">{t.loading}</p>}>
        <VerifyEmailInner />
      </Suspense>
    </div>
  );
}
