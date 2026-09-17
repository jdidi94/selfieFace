'use client';

import { getMessages } from '@/lib/messages';
import { useLocale } from '@/lib/locale-context';
import { useAuth } from '@/lib/auth-context';
import { apiUrl } from '@/lib/api';
import type { LoyaltyAccountDto } from '@lumea/types';
import { Button, Card, CardContent, CardHeader, CardTitle, LoadingState } from '@lumea/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function AccountLoyaltyPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [account, setAccount] = useState<LoyaltyAccountDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/loyalty/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(t.loyaltyError);
      setAccount((await res.json()) as LoyaltyAccountDto);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loyaltyError);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, t.loyaltyError]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/account/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  if (authLoading || loading) {
    return <LoadingState label={t.loyaltyLoading} />;
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8 px-6 py-16">
      <div>
        <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t.accountTitle}
        </Link>
        <h1 className="font-display mt-2 text-4xl text-foreground">{t.loyaltyTitle}</h1>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!account?.config.enabled ? (
        <p className="text-sm text-muted-foreground">{t.loyaltyDisabled}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t.loyaltyBalance(account.balance)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t.loyaltyEarnHint(account.config.pointsPerMajorUnit)}</p>
              <p>
                1 pt → {account.config.pointValueMinor} minor units
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.loyaltyLedger}</CardTitle>
            </CardHeader>
            <CardContent>
              {account.ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.loyaltyLedgerEmpty}</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {account.ledger.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{entry.type.replace(/_/g, ' ')}</p>
                        {entry.note ? (
                          <p className="text-muted-foreground">{entry.note}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={
                          entry.points >= 0 ? 'text-foreground' : 'text-muted-foreground'
                        }
                      >
                        {entry.points >= 0 ? '+' : ''}
                        {entry.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Button variant="outline" asChild>
        <Link href="/account">{t.accountTitle}</Link>
      </Button>
    </div>
  );
}
