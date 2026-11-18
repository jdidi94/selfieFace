'use client';

import { authFetch, fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { StockNotifySubscribeResponse } from '@lumea/types';
import { Button, Input } from '@lumea/ui';
import { useEffect, useMemo, useState } from 'react';

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
  const storageKey = useMemo(
    () => `stock-notify:${productId}:${variantId ?? 'all'}:${user?.id ?? 'guest'}`,
    [productId, variantId, user?.id],
  );
  const [doneKey, setDoneKey] = useState('');
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem(storageKey); } catch { /* storage is optional */ }
      if (saved && !cancelled) {
        setDoneKey(storageKey);
        setVerificationRequired(saved === 'pending-verification');
      }
      if (!accessToken) return;
      try {
        const query = new URLSearchParams({ productId, ...(variantId ? { variantId } : {}) });
        const status = await authFetch<{ subscribed: boolean }>(`/stock-notify/status?${query}`, accessToken);
        if (cancelled) return;
        if (status.subscribed) {
          setDoneKey(storageKey);
          setVerificationRequired(false);
          try { window.localStorage.setItem(storageKey, 'subscribed'); } catch { /* storage is optional */ }
        } else {
          setDoneKey('');
          setVerificationRequired(false);
          try { window.localStorage.removeItem(storageKey); } catch { /* storage is optional */ }
        }
      } catch {
        // Keep the local confirmation if the status endpoint is temporarily unavailable.
      }
    }
    void loadStatus();
    return () => { cancelled = true; };
  }, [accessToken, productId, storageKey, variantId]);

  const done = doneKey === storageKey;

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
      const requiresVerification = Boolean(res.requiresVerification);
      setVerificationRequired(requiresVerification);
      setDoneKey(storageKey);
      try {
        window.localStorage.setItem(
          storageKey,
          requiresVerification ? 'pending-verification' : 'subscribed',
        );
      } catch {
        // The confirmation still works if browser storage is unavailable.
      }
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
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {verificationRequired
          ? locale === 'ar'
            ? 'تحققي من بريدك الإلكتروني لتأكيد طلب الإشعار.'
            : locale === 'fr'
              ? 'Vérifiez votre e-mail pour confirmer votre demande.'
              : 'Check your email to confirm this notification request.'
          : t.notifyStockSuccess}
        </p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
            setDoneKey('');
            setVerificationRequired(false);
          }}
        >
          {locale === 'ar' ? 'استخدام بريد إلكتروني آخر' : locale === 'fr' ? 'Utiliser un autre e-mail' : 'Use another email'}
        </button>
      </div>
    );
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
