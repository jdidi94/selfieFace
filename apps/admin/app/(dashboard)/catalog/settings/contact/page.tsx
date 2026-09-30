'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { SettingsSubnav } from '@/components/settings-subnav';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { storeSettingsUpdateSchema } from '@lumea/validation';
import type { StoreSettingsDto } from '@lumea/types';
import { Button, Input, Label, LoadingState } from '@lumea/ui';
import { useEffect, useState, type FormEvent } from 'react';

export default function ContactSettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }).then(
      setSettings,
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
        'Are you sure you want to save “Contact & social”? This updates live storefront settings.',
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);

    const body = {
      contactWhatsapp: settings.contactWhatsapp,
      contactPhone: settings.contactPhone,
      contactFacebook: settings.contactFacebook,
      contactInstagram: settings.contactInstagram,
      contactEmail: settings.contactEmail,
    };

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
      setMessage('Contact & social saved.');
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setPending(false);
    }
  }

  if (authLoading || !settings) return <LoadingState />;

  function textField(key: keyof StoreSettingsDto, label: string, hint?: string) {
    return (
      <div className="space-y-2">
        <Label htmlFor={String(key)}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <Input
          id={String(key)}
          value={String(settings![key] ?? '')}
          onChange={(e) =>
            setSettings((prev) =>
              prev ? { ...prev, [key]: e.target.value || null } : prev,
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">Contact & social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Storefront contact details and social links for this market. Leave a field blank to hide
          it on the footer. Saving updates only these fields — no full page reload.
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
          <h2 className="font-display text-xl">Storefront contact</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact details for this market window only. Leave a field blank to hide it on the
            storefront footer.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {textField(
            'contactWhatsapp',
            'WhatsApp',
            'Full URL or phone digits (e.g. https://wa.me/216… or +216…).',
          )}
          {textField('contactPhone', 'Phone')}
          {textField('contactFacebook', 'Facebook URL')}
          {textField('contactInstagram', 'Instagram URL')}
          {textField('contactEmail', 'Email')}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save contact & social'}
        </Button>
      </form>
    </div>
  );
}
