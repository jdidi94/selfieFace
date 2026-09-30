'use client';

import { Button, Input, Label, cn } from '@lumea/ui';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { PasswordField } from '@/components/password-field';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { authPathWithReturn, getSafeAuthReturnPath } from '@/lib/auth-return';
import { LocaleLink } from '@/components/locale-link';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const returnPath = getSafeAuthReturnPath(searchParams.get('next'));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (mode === 'register') {
      const confirm = String(form.get('confirmPassword') ?? '');
      if (password !== confirm) {
        setError(t.passwordMismatch);
        setPending(false);
        return;
      }
    }
    try {
      await onSubmit({
        email: String(form.get('email') ?? ''),
        password,
        firstName: String(form.get('firstName') ?? '') || undefined,
        lastName: String(form.get('lastName') ?? '') || undefined,
      });
      router.replace(returnPath);
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
      <PasswordField
        id="password"
        name="password"
        label={t.password}
        showLabel={t.showPassword}
        hideLabel={t.hidePassword}
        required
        minLength={8}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />
      {mode === 'register' && (
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label={t.confirmPassword}
          showLabel={t.showPassword}
          hideLabel={t.hidePassword}
          required
          minLength={8}
          autoComplete="new-password"
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className={cn('w-full', bannerCtaPrimaryClassName)} disabled={pending}>
        {pending ? t.pleaseWait : mode === 'login' ? t.signIn : t.createAccount}
      </Button>
      <div className="relative py-2 text-center text-xs text-muted-foreground">
        <span className="bg-background relative z-10 px-2">{t.or}</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>
      <GoogleSignInButton returnPath={returnPath} />
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <>
            {t.newToLumea}{' '}
            <LocaleLink
              href={authPathWithReturn('/account/register', returnPath)}
              className="text-foreground underline"
            >
              {t.register}
            </LocaleLink>
          </>
        ) : (
          <>
            {t.alreadyHaveAccount}{' '}
            <LocaleLink
              href={authPathWithReturn('/account/login', returnPath)}
              className="text-foreground underline"
            >
              {t.signIn}
            </LocaleLink>
          </>
        )}
      </p>
    </form>
  );
}
