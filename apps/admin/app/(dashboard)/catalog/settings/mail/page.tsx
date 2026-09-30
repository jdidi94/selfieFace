'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { SettingsSubnav } from '@/components/settings-subnav';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { mailRecipientUpsertSchema, storeSettingsUpdateSchema } from '@lumea/validation';
import type { MailRecipientDto, MailRecipientType, StoreSettingsDto } from '@lumea/types';
import { Badge, Button, Input, LoadingState } from '@lumea/ui';
import { useEffect, useState, type FormEvent } from 'react';

const mailToggles: { key: keyof StoreSettingsDto; label: string; detail: string }[] = [
  {
    key: 'mailingEnabled',
    label: 'Mail delivery service',
    detail: 'Master switch for outbound emails. Turn this off to pause all mail without removing configuration.',
  },
  {
    key: 'customerOrderEmailsEnabled',
    label: 'Customer order updates',
    detail: 'Order confirmation, shipped, delivered, and cancellation emails. Customers can also opt out in their profile.',
  },
  {
    key: 'adminOrderEmailsEnabled',
    label: 'New order alerts',
    detail: 'Send new-order notices to verified recipients below.',
  },
  {
    key: 'adminStockEmailsEnabled',
    label: 'Low-stock alerts',
    detail: 'Send a notice when inventory reaches the configured low-stock threshold.',
  },
  {
    key: 'mailLogsEnabled',
    label: 'Email delivery logs',
    detail: 'Store send, skip, and failure metadata in admin email logs. Disabling this does not stop delivery.',
  },
];

export default function MailSettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [recipients, setRecipients] = useState<MailRecipientDto[]>([]);
  const [email, setEmail] = useState('');
  const [type, setType] = useState<MailRecipientType>('NEW_ORDER');
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setSettingsLoading(true);
    try {
      const [loadedSettings, loadedRecipients] = await Promise.all([
        adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }),
        adminFetch<MailRecipientDto[]>('/admin/mail/recipients', accessToken, { skipCache: true }),
      ]);
      setSettings(loadedSettings);
      setRecipients(loadedRecipients);
    } finally {
      setSettingsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void load().catch((err) => setError(submitErrorState(err).message));
  }, [accessToken, authLoading, market]);

  function toggle(key: keyof StoreSettingsDto, checked: boolean) {
    setSettings((current) => (current ? { ...current, [key]: checked } : current));
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !settings) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const body = Object.fromEntries(mailToggles.map(({ key }) => [key, settings[key]]));
      const validated = validateWithSchema(storeSettingsUpdateSchema, body);
      if (!validated.ok) throw new Error(validated.message);
      const updated = await adminFetch<StoreSettingsDto>('/admin/settings', accessToken, {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      });
      setSettings(updated);
      setMessage('Email settings saved for this market.');
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setPending(false);
    }
  }

  async function addRecipient(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const validated = validateWithSchema(mailRecipientUpsertSchema, { email, type });
      if (!validated.ok) throw new Error(validated.message);
      const saved = await adminFetch<MailRecipientDto>('/admin/mail/recipients', accessToken, {
        method: 'POST',
        body: JSON.stringify(validated.data),
      });
      setEmail('');
      await load();
      setMessage(
        saved.verifiedAt
          ? 'This recipient is already verified and will receive the selected alerts.'
          : 'Recipient saved as pending. It will receive alerts only after the address is verified.',
      );
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setPending(false);
    }
  }

  async function recipientAction(id: string, action: 'verify' | 'delete') {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      if (action === 'delete') {
        if (!window.confirm('Remove this alert recipient?')) return;
        await adminFetch(`/admin/mail/recipients/${id}`, accessToken, { method: 'DELETE' });
      } else {
        await adminFetch(`/admin/mail/recipients/${id}/verify`, accessToken, { method: 'POST' });
        setMessage('A fresh verification email was requested. The recipient stays inactive until verified.');
      }
      await load();
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || settingsLoading) return <LoadingState />;
  if (!settings) {
    return (
      <div className="space-y-3">
        <FormErrorBanner message={error ?? 'Email settings could not be loaded.'} />
        <Button variant="outline" onClick={() => void load().catch((err) => setError(submitErrorState(err).message))}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Email settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage delivery, customer order updates, operational alerts, and logs for the selected market.
        </p>
        <SettingsSubnav className="mt-4" />
      </div>
      {error ? <FormErrorBanner message={error} /> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <form onSubmit={saveSettings} className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="font-display text-xl">Notification controls</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mail configuration still requires valid SES credentials on the server.</p>
        </div>
        {mailToggles.map(({ key, label, detail }) => (
          <label key={key} className="flex gap-3 rounded-md border border-border p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
              checked={Boolean(settings[key])}
              onChange={(event) => toggle(key, event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
            </span>
          </label>
        ))}
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save email settings'}</Button>
      </form>

      <section className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="font-display text-xl">Verified alert recipients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New addresses must confirm a one-time link sent to their inbox before they receive notifications.
          </p>
        </div>
        <form onSubmit={addRecipient} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            aria-label="Recipient email"
            required
            className="min-w-0 flex-1"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MailRecipientType)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="Alert type"
          >
            <option value="NEW_ORDER">New orders</option>
            <option value="STOCK_ALERT">Stock alerts</option>
          </select>
          <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Add recipient'}</Button>
        </form>
        {recipients.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {recipients.map((recipient) => (
              <li key={recipient.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{recipient.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{recipient.type === 'NEW_ORDER' ? 'New orders' : 'Stock alerts'}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {recipient.verifiedAt ? `Verified ${new Date(recipient.verifiedAt).toLocaleDateString()}` : 'Verification pending'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!recipient.verifiedAt ? (
                    <Button type="button" variant="outline" size="sm" disabled={busyId === recipient.id} onClick={() => void recipientAction(recipient.id, 'verify')}>
                      Resend verification
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" disabled={busyId === recipient.id} onClick={() => void recipientAction(recipient.id, 'delete')}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No alert recipients configured yet.</p>
        )}
      </section>
    </div>
  );
}
