'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { SecretInput } from '@/components/secret-input';
import { SettingsSubnav } from '@/components/settings-subnav';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { storeSettingsUpdateSchema } from '@lumea/validation';
import type { StoreSettingsDto } from '@lumea/types';
import { Button, Input, Label, LoadingState } from '@lumea/ui';
import { useEffect, useState, type FormEvent } from 'react';

type SecretDraft = {
  stripeSecretKey: string;
  stripePublishableKey: string;
  konnectApiKey: string;
  konnectWalletId: string;
};

const emptySecrets = (): SecretDraft => ({
  stripeSecretKey: '',
  stripePublishableKey: '',
  konnectApiKey: '',
  konnectWalletId: '',
});

function secretsFromSettings(data: StoreSettingsDto): SecretDraft {
  return {
    ...emptySecrets(),
    stripePublishableKey: data.stripePublishableKey ?? '',
  };
}

export default function PaymentSettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [secrets, setSecrets] = useState<SecretDraft>(emptySecrets());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }).then(
      (data) => {
        setSettings(data);
        setSecrets(secretsFromSettings(data));
      },
    );
  }, [accessToken, authLoading, market]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !settings) {
      setError('You must be signed in to save settings');
      return;
    }
    if (
      !window.confirm(
        'Are you sure you want to save “Payment methods”? This updates live storefront settings.',
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);

    const body: Record<string, unknown> = {
      cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled,
      cardPaymentEnabled: settings.cardPaymentEnabled,
      stripeEnabled: settings.stripeEnabled,
      konnectEnabled: settings.konnectEnabled,
      konnectSandbox: settings.konnectSandbox,
    };
    if (secrets.stripeSecretKey.trim()) {
      body.stripeSecretKey = secrets.stripeSecretKey.trim();
    }
    if (secrets.stripePublishableKey.trim()) {
      body.stripePublishableKey = secrets.stripePublishableKey.trim();
    }
    if (secrets.konnectApiKey.trim()) {
      body.konnectApiKey = secrets.konnectApiKey.trim();
    }
    if (secrets.konnectWalletId.trim()) {
      body.konnectWalletId = secrets.konnectWalletId.trim();
    }

    try {
      const validated = validateWithSchema(storeSettingsUpdateSchema, body);
      if (!validated.ok) {
        setError(validated.message);
        setPending(false);
        return;
      }

      const updated = await adminFetch<StoreSettingsDto>('/admin/settings', accessToken, {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      });
      setSettings(updated);
      setSecrets(secretsFromSettings(updated));
      setMessage('Payment methods saved.');
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setPending(false);
    }
  }

  if (authLoading || !settings) return <LoadingState />;

  function toggle(key: keyof StoreSettingsDto, checked: boolean) {
    setSettings((prev) => (prev ? { ...prev, [key]: checked } : prev));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">Payment methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          COD, card toggles, and provider API keys for this market. Secrets are encrypted at rest;
          leave a secret blank to keep the current value. Saving updates only these fields — no
          full page reload.
        </p>
        <SettingsSubnav className="mt-4" />
      </div>

      {error ? <FormErrorBanner message={error} /> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <div>
          <h2 className="font-display text-xl">Providers & secrets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cash on delivery is available in every currency. Card checkout uses Stripe for AED and
            USD (when Stripe is enabled and keys are set), and Konnect for TND (when Konnect is
            enabled and keys are set). Currency comes from the storefront cookie.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.cashOnDeliveryEnabled}
            onChange={(e) => toggle('cashOnDeliveryEnabled', e.target.checked)}
          />
          Cash on delivery (COD)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.cardPaymentEnabled}
            onChange={(e) => toggle('cardPaymentEnabled', e.target.checked)}
          />
          Card payment (master switch)
        </label>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Stripe (AED / USD)</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={settings.stripeEnabled}
                onChange={(e) => toggle('stripeEnabled', e.target.checked)}
              />
              Enabled
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Shown at checkout when the currency cookie is AED or USD, card payment is on, and keys
            are configured. Secret:{' '}
            {settings.stripeSecretKeySet ? 'configured' : 'not set'} (env fallback supported). Leave
            secret blank to keep the current value.
          </p>
          <div className="space-y-2">
            <Label>Stripe secret key</Label>
            <SecretInput
              autoComplete="off"
              value={secrets.stripeSecretKey}
              onChange={(e) =>
                setSecrets((s) => ({ ...s, stripeSecretKey: e.target.value }))
              }
              placeholder="sk_live_… or sk_test_…"
            />
          </div>
          <div className="space-y-2">
            <Label>Stripe publishable key</Label>
            <Input
              value={secrets.stripePublishableKey}
              onChange={(e) =>
                setSecrets((s) => ({ ...s, stripePublishableKey: e.target.value }))
              }
              placeholder="pk_live_… or pk_test_…"
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Konnect (TND)</h3>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.konnectEnabled}
                  onChange={(e) => toggle('konnectEnabled', e.target.checked)}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.konnectSandbox}
                  onChange={(e) => toggle('konnectSandbox', e.target.checked)}
                />
                Sandbox
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Shown at checkout when the currency cookie is TND, card payment is on, and API key +
            wallet ID are set. API key:{' '}
            {settings.konnectApiKeySet ? 'configured' : 'not set'}; wallet:{' '}
            {settings.konnectWalletIdSet ? 'configured' : 'not set'} (env fallback supported). Leave
            secrets blank to keep current values.
          </p>
          <div className="space-y-2">
            <Label>Konnect API key</Label>
            <SecretInput
              autoComplete="off"
              value={secrets.konnectApiKey}
              onChange={(e) => setSecrets((s) => ({ ...s, konnectApiKey: e.target.value }))}
              placeholder="orgId:secret…"
            />
          </div>
          <div className="space-y-2">
            <Label>Konnect wallet ID</Label>
            <SecretInput
              autoComplete="off"
              value={secrets.konnectWalletId}
              onChange={(e) => setSecrets((s) => ({ ...s, konnectWalletId: e.target.value }))}
              placeholder="Leave blank to keep current"
            />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save payment methods'}
        </Button>
      </form>
    </div>
  );
}
