'use client';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';

export default function RegisterPage() {
  const { register } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display mb-2 text-4xl text-foreground">{t.registerTitle}</h1>
      <p className="mb-8 text-muted-foreground">{t.registerSubtitle}</p>
      <AuthForm mode="register" onSubmit={register} />
      <p className="mt-6 text-sm text-muted-foreground">{t.verifyEmailBannerHint}</p>
    </div>
  );
}
