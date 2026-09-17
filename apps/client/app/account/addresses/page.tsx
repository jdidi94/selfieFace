'use client';

import { AccountAddressesForm } from '@/components/account-addresses-form';
import { LocaleLink } from '@/components/locale-link';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { Button, LoadingState } from '@lumea/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AccountAddressesPage() {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/account/login?next=/account/addresses');
    }
  }, [loading, user, router]);

  if (loading) {
    return <LoadingState label={t.loadingAddresses} />;
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8 px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-foreground">{t.addressesTitle}</h1>
        <Button variant="outline" asChild>
          <LocaleLink href="/account">{t.backToAccount}</LocaleLink>
        </Button>
      </div>
      <AccountAddressesForm />
    </div>
  );
}
