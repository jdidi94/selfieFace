'use client';

import { AccountProfileForm } from '@/components/account-profile-form';
import { getMessages } from '@/lib/messages';
import { useLocale } from '@/lib/locale-context';
import { Button, Card, CardContent, CardHeader, CardTitle, LoadingState } from '@lumea/ui';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AccountPage() {
  const { user, accessToken, loading, logout, refreshSession } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/account/login');
    }
  }, [loading, user, router]);

  async function resendVerification() {
    if (!accessToken) return;
    setResendPending(true);
    setResendMessage(null);
    try {
      const data = await authFetch<{ message: string }>(
        '/auth/resend-verification/me',
        accessToken,
        { method: 'POST', body: '{}' },
      );
      setResendMessage(data.message);
      await refreshSession();
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : t.somethingWentWrong);
    } finally {
      setResendPending(false);
    }
  }

  if (loading) {
    return <LoadingState label={t.loadingAccount} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-6 py-16">
      <h1 className="font-display text-4xl text-foreground">{t.accountTitle}</h1>
      {!user.emailVerified && (
        <div className="border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="text-foreground">{t.verifyEmailBanner}</p>
          <p className="mt-1 text-muted-foreground">{t.verifyEmailBannerHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resendPending}
              onClick={() => void resendVerification()}
            >
              {resendPending ? t.pleaseWait : t.verifyEmailResend}
            </Button>
            {resendMessage && (
              <span className="text-muted-foreground">{resendMessage}</span>
            )}
          </div>
        </div>
      )}
      <AccountProfileForm
        labels={{
          title: t.profileTitle,
          firstName: t.profileFirstName,
          lastName: t.profileLastName,
          phone: t.profilePhone,
          preferredLocale: t.profilePreferredLocale,
          save: t.profileSave,
          saved: t.profileSaved,
          none: t.profileNone,
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>{user.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {t.signedInAs} <span className="text-foreground">{user.type}</span>
            {user.emailVerified ? (
              <> · <span className="text-foreground">{t.emailVerifiedLabel}</span></>
            ) : (
              <> · <span className="text-foreground">{t.emailUnverifiedLabel}</span></>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/account/orders">{t.viewOrders}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/account/loyalty">{t.viewLoyalty}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/account/addresses">{t.addressesTitle}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/wishlist">{t.wishlist}</Link>
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              {t.signOut}
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/">{t.backToShop}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
