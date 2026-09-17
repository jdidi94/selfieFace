'use client';

import { Button, Input, Label, cn } from '@lumea/ui';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const email = new FormData(e.currentTarget).get('email');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? t.somethingWentWrong);
      setMessage(data.message ?? t.somethingWentWrong);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWentWrong);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display mb-2 text-4xl">{t.forgotTitle}</h1>
      <p className="mb-8 text-muted-foreground">{t.forgotSubtitle}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t.email}</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        {message && <p className="text-sm text-foreground">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className={cn('w-full', bannerCtaPrimaryClassName)}>
          {t.sendResetLink}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/account/login" className="underline">
          {t.backToSignIn}
        </Link>
      </p>
    </div>
  );
}
