'use client';

import { Button, Input, Label, cn } from '@lumea/ui';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type AuthFormProps = {
  mode: 'login' | 'register';
  onSubmit: (values: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
};

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await onSubmit({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        firstName: String(form.get('firstName') ?? '') || undefined,
        lastName: String(form.get('lastName') ?? '') || undefined,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWentWrong);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
      {mode === 'register' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t.firstName}</Label>
            <Input id="firstName" name="firstName" autoComplete="given-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t.lastName}</Label>
            <Input id="lastName" name="lastName" autoComplete="family-name" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{t.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className={cn('w-full', bannerCtaPrimaryClassName)} disabled={pending}>
        {pending ? t.pleaseWait : mode === 'login' ? t.signIn : t.createAccount}
      </Button>
      <div className="relative py-2 text-center text-xs text-muted-foreground">
        <span className="bg-background relative z-10 px-2">{t.or}</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>
      <GoogleSignInButton />
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <>
            {t.newToLumea}{' '}
            <Link href="/account/register" className="text-foreground underline">
              {t.register}
            </Link>
          </>
        ) : (
          <>
            {t.alreadyHaveAccount}{' '}
            <Link href="/account/login" className="text-foreground underline">
              {t.signIn}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
