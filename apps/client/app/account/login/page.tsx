'use client';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function GoogleErrorBanner() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getMessages(locale);
  if (searchParams.get('error') !== 'google') return null;
  return <p className="mb-4 text-sm text-destructive">{t.googleSignInFailed}</p>;
}

export default function LoginPage() {
  const { login } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display mb-2 text-4xl text-foreground">{t.loginTitle}</h1>
      <p className="mb-8 text-muted-foreground">{t.loginSubtitle}</p>
      <Suspense fallback={null}>
        <GoogleErrorBanner />
      </Suspense>
      <AuthForm mode="login" onSubmit={({ email, password }) => login(email, password)} />
      <p className="mt-6 text-center text-sm">
        <Link href="/account/forgot-password" className="text-muted-foreground underline">
          {t.forgotPassword}
        </Link>
      </p>
    </div>
  );
}
