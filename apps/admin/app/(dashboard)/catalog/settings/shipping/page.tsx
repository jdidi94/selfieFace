'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { SettingsSubnav } from '@/components/settings-subnav';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { storeSettingsUpdateSchema } from '@lumea/validation';
import type { ShippingMethodDto, StoreSettingsDto } from '@lumea/types';
import { Button, Input, Label, LoadingState } from '@lumea/ui';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type SectionId = 'shipping' | 'legacy';

function confirmSave(sectionLabel: string): boolean {
  return window.confirm(
    `Are you sure you want to save “${sectionLabel}”? This updates live storefront settings.`,
  );
}

export default function ShippingSettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [pendingSection, setPendingSection] = useState<SectionId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }).then(
      setSettings,
    );
  }, [accessToken, authLoading, market]);

  async function saveSection(
    section: SectionId,
    label: string,
    body: Record<string, unknown>,
  ) {
    if (!accessToken) {
      setError('You must be signed in to save settings');
      return;
    }
    if (!confirmSave(label)) return;

    setPendingSection(section);
    setMessage(null);
    setError(null);
    try {
      const validated = validateWithSchema(storeSettingsUpdateSchema, body);
      if (!validated.ok) {
        setError(validated.message);
        setPendingSection(null);
        return;
      }

      const updated = await adminFetch<StoreSettingsDto>('/admin/settings', accessToken, {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      });
      setSettings(updated);
      setMessage(`${label} saved.`);
    } catch (err) {
      setError(submitErrorState(err).message);
    } finally {
      setPendingSection(null);
    }
  }

  if (authLoading || !settings) return <LoadingState />;

  function numField(
    key: keyof StoreSettingsDto,
    label: string,
    hint?: string,
  ) {
    return (
      <div className="space-y-2">
        <Label htmlFor={String(key)}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <Input
          id={String(key)}
          value={String(settings![key] ?? '')}
          onChange={(e) =>
            setSettings((prev) =>
              prev ? { ...prev, [key]: Number(e.target.value) || 0 } : prev,
            )
          }
        />
      </div>
    );
  }

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

  function updateMethod(id: string, patch: Partial<ShippingMethodDto>) {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            shippingMethods: prev.shippingMethods.map((m) =>
              m.id === id ? { ...m, ...patch } : m,
            ),
          }
        : prev,
    );
  }

  function toggle(key: keyof StoreSettingsDto, checked: boolean) {
    setSettings((prev) => (prev ? { ...prev, [key]: checked } : prev));
  }

  function Section({
    title,
    explanation,
    children,
    onSave,
    section,
    saveLabel,
  }: {
    title: string;
    explanation: string;
    children: ReactNode;
    onSave: (e: FormEvent) => void;
    section: SectionId;
    saveLabel?: string;
  }) {
    return (
      <form
        onSubmit={onSave}
        className="space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
        </div>
        {children}
        <Button type="submit" disabled={pendingSection !== null}>
          {pendingSection === section
            ? 'Saving…'
            : saveLabel ?? `Save ${title.toLowerCase()}`}
        </Button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">Shipping</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free shipping, methods, and domestic country codes for this market. Each block saves on
          its own — no full page reload. Money fields use minor units (100 = 1.00).
        </p>
        <SettingsSubnav className="mt-4" />
      </div>

      {error ? <FormErrorBanner message={error} /> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Section
        section="shipping"
        title="Shipping"
        explanation="Customers pick one method at checkout. Mark “Free shipping eligible” on Standard so cart total ≥ threshold makes that option free. Domestic country codes decide which zone applies."
        onSave={(e) => {
          e.preventDefault();
          void saveSection('shipping', 'Shipping', {
            domesticCountries: settings.domesticCountries,
            freeShippingEnabled: settings.freeShippingEnabled,
            freeShippingThreshold: settings.freeShippingThreshold,
            shippingMethods: settings.shippingMethods,
          });
        }}
      >
        {textField(
          'domesticCountries',
          'Domestic country codes (comma-separated)',
          'Example: TN,AE,US. Other countries use international rates.',
        )}
        <div className="space-y-3 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Free shipping</h3>
          <p className="text-xs text-muted-foreground">
            Optional. Values use this market’s currency (working market switcher). When disabled,
            the threshold and progress UI are ignored. Methods still need “Free shipping eligible”
            checked.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.freeShippingEnabled}
              onChange={(e) => toggle('freeShippingEnabled', e.target.checked)}
            />
            Enable free shipping
          </label>
          {numField(
            'freeShippingThreshold',
            'Threshold (minor units)',
            settings.freeShippingEnabled ? undefined : 'Disabled for this market.',
          )}
        </div>
        <div className="space-y-4">
          {settings.shippingMethods.map((method, index) => (
            <div
              key={method.id}
              className="space-y-3 rounded-lg border border-border bg-surface-muted/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Option {index + 1} ·{' '}
                  <span className="text-muted-foreground">{method.code}</span>
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={method.isActive}
                    onChange={(e) => updateMethod(method.id, { isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={method.name}
                    onChange={(e) => updateMethod(method.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={method.description ?? ''}
                    onChange={(e) =>
                      updateMethod(method.id, { description: e.target.value || null })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Price (minor units, market currency)</Label>
                <Input
                  value={method.price}
                  onChange={(e) =>
                    updateMethod(method.id, { price: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Est. days min</Label>
                  <Input
                    value={method.estimatedDaysMin ?? ''}
                    onChange={(e) =>
                      updateMethod(method.id, {
                        estimatedDaysMin: e.target.value
                          ? Number(e.target.value) || null
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Est. days max</Label>
                  <Input
                    value={method.estimatedDaysMax ?? ''}
                    onChange={(e) =>
                      updateMethod(method.id, {
                        estimatedDaysMax: e.target.value
                          ? Number(e.target.value) || null
                          : null,
                      })
                    }
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={method.eligibleForFreeShipping}
                    onChange={(e) =>
                      updateMethod(method.id, {
                        eligibleForFreeShipping: e.target.checked,
                      })
                    }
                  />
                  Free shipping eligible
                </label>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        section="legacy"
        title="Legacy zone flat rates"
        explanation="Used only if no shipping methods exist. Prefer the shipping methods section above. Amounts are in this market’s currency."
        saveLabel="Save legacy rates"
        onSave={(e) => {
          e.preventDefault();
          void saveSection('legacy', 'Legacy zone flat rates', {
            domesticShipping: settings.domesticShipping,
            internationalShipping: settings.internationalShipping,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {numField('domesticShipping', 'Domestic shipping (minor units)')}
          {numField('internationalShipping', 'Intl shipping (minor units)')}
        </div>
      </Section>
    </div>
  );
}
