'use client';

import { authFetch, fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { StockNotifySubscribeResponse } from '@lumea/types';
import { Button, Input } from '@lumea/ui';
import { useEffect, useState } from 'react';

export function BackInStockForm({
  productId,
  variantId,
  compact = false,
}: {
  productId: string;
  variantId?: string | null;
  compact?: boolean;
}) {
  const { user, accessToken } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [email, setEmail] = useState(user?.email ?? '');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body = {
        productId,
        variantId: variantId ?? undefined,
        locale,
        ...(!user ? { email: email.trim() } : {}),
      };
      const res = accessToken
        ? await authFetch<StockNotifySubscribeResponse>('/stock-notify', accessToken, {
            method: 'POST',
            body: JSON.stringify(body),
          })
        : await fetchApi<StockNotifySubscribeResponse>('/stock-notify', {
            method: 'POST',
            body: JSON.stringify(body),
          });
      setDone(true);
      if (res.alreadySubscribed) {
        // still success UX
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.notifyStockError);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="text-sm text-muted-foreground">{t.notifyStockSuccess}</p>;
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={compact ? 'space-y-2' : 'mt-3 space-y-2 rounded-sm border border-border p-3'}
    >
      <p className={compact ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
        {t.notifyStockPrompt}
      </p>
      {!user && (
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email}
          aria-label={t.email}
          className="h-9"
        />
      )}
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full">
        {pending ? t.notifyStockSubmitting : t.notifyStockCta}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
