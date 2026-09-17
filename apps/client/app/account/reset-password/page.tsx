'use client';

import { Button, Input, Label, cn } from '@lumea/ui';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const token = searchParams.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? t.somethingWentWrong);
      router.push('/account/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWentWrong);
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return <p className="text-destructive">{t.missingResetToken}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t.newPassword}</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className={cn('w-full', bannerCtaPrimaryClassName)}>
        {t.updatePassword}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display mb-2 text-4xl">{t.resetTitle}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.loading}</p>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-6 text-center text-sm">
        <Link href="/account/login" className="underline">
          {t.backToSignIn}
        </Link>
      </p>
    </div>
  );
}
