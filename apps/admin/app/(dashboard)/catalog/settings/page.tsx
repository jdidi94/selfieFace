'use client';

import { FormErrorBanner } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { storeSettingsUpdateSchema } from '@lumea/validation';
import type { ShippingMethodDto, StoreSettingsDto } from '@lumea/types';
import { Button, Input, Label, LoadingState } from '@lumea/ui';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type SecretDraft = {
  stripeSecretKey: string;
  stripePublishableKey: string;
  konnectApiKey: string;
  konnectWalletId: string;
};

type SectionId =
  | 'tax'
  | 'inventory'
  | 'loyalty'
  | 'payments'
  | 'shipping'
  | 'contact'
  | 'legacy';

function confirmSave(sectionLabel: string): boolean {
  return window.confirm(
    `Are you sure you want to save “${sectionLabel}”? This updates live storefront settings.`,
  );
}

export default function StoreSettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [secrets, setSecrets] = useState<SecretDraft>({
    stripeSecretKey: '',
    stripePublishableKey: '',
    konnectApiKey: '',
    konnectWalletId: '',
  });
  const [pendingSection, setPendingSection] = useState<SectionId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }).then(
      (data) => {
        setSettings(data);
        setSecrets({
          stripeSecretKey: '',
          stripePublishableKey: data.stripePublishableKey ?? '',
          konnectApiKey: '',
          konnectWalletId: data.konnectWalletId ?? '',
        });
      },
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
      setSecrets({
        stripeSecretKey: '',
        stripePublishableKey: updated.stripePublishableKey ?? '',
        konnectApiKey: '',
        konnectWalletId: updated.konnectWalletId ?? '',
      });
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

  const taxPercent = (settings.taxRateBps / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">Store settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each block saves on its own. You will be asked to confirm before changes go live.
          Money fields use minor units (100 = 1.00).
        </p>
      </div>

      {error ? <FormErrorBanner message={error} /> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Section
        section="tax"
        title="Tax"
        explanation={`Applied on (subtotal − discount + shipping) and included in the card charge. Current rate: ${taxPercent}%. Basis points: 1000 = 10%.`}
        onSave={(e) => {
          e.preventDefault();
          void saveSection('tax', 'Tax', { taxRateBps: settings.taxRateBps });
        }}
      >
        {numField('taxRateBps', 'Tax rate (basis points)', 'Example: 1000 means 10%.')}
      </Section>

      <Section
        section="inventory"
        title="Inventory alerts"
        explanation="Variants at or below this stock count show a Low badge in admin. When SES and SES_ADMIN_NOTIFY_EMAIL are configured, crossing the threshold also emails admins."
        onSave={(e) => {
          e.preventDefault();
          void saveSection('inventory', 'Inventory alerts', {
            lowStockThreshold: settings.lowStockThreshold,
          });
        }}
      >
        {numField('lowStockThreshold', 'Low-stock threshold')}
      </Section>

      <Section
        section="loyalty"
        title="Loyalty program"
        explanation="When enabled, signed-in customers earn points on committed orders (card CAPTURED / COD AUTHORIZED) and may redeem at checkout. Earn rate is points per 1.00 of merchandise after discounts. Point value is the discount in minor units per point."
        onSave={(e) => {
          e.preventDefault();
          void saveSection('loyalty', 'Loyalty program', {
            loyaltyEnabled: settings.loyaltyEnabled,
            loyaltyPointsPerMajorUnit: settings.loyaltyPointsPerMajorUnit,
            loyaltyPointValueMinor: settings.loyaltyPointValueMinor,
            loyaltyMinOrderMinor: settings.loyaltyMinOrderMinor,
            loyaltyMaxRedeemBps: settings.loyaltyMaxRedeemBps,
            loyaltySignupBonusPoints: settings.loyaltySignupBonusPoints,
          });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.loyaltyEnabled}
            onChange={(e) => toggle('loyaltyEnabled', e.target.checked)}
          />
          Enable loyalty program
        </label>
        {numField('loyaltyPointsPerMajorUnit', 'Points earned per 1.00 spent')}
        {numField('loyaltyPointValueMinor', 'Value of 1 point (minor units)')}
        <div className="space-y-2">
          <Label htmlFor="loyaltyMinOrderMinor">Min order to redeem (minor units, blank = none)</Label>
          <Input
            id="loyaltyMinOrderMinor"
            value={settings.loyaltyMinOrderMinor ?? ''}
            onChange={(e) =>
              setSettings((prev) =>
                prev
                  ? {
                      ...prev,
                      loyaltyMinOrderMinor: e.target.value.trim()
                        ? Number(e.target.value) || 0
                        : null,
                    }
                  : prev,
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loyaltyMaxRedeemBps">
            Max redeem % of subtotal (basis points, blank = none; 5000 = 50%)
          </Label>
          <Input
            id="loyaltyMaxRedeemBps"
            value={settings.loyaltyMaxRedeemBps ?? ''}
            onChange={(e) =>
              setSettings((prev) =>
                prev
                  ? {
                      ...prev,
                      loyaltyMaxRedeemBps: e.target.value.trim()
                        ? Number(e.target.value) || 0
                        : null,
                    }
                  : prev,
              )
            }
          />
        </div>
        {numField('loyaltySignupBonusPoints', 'Signup bonus points')}
      </Section>

      <Section
        section="payments"
        title="Payment methods"
        explanation="Cash on delivery is available in every currency. Card checkout uses Stripe for AED and USD (when Stripe is enabled and keys are set), and Konnect for TND (when Konnect is enabled and keys are set). Currency comes from the storefront cookie."
        onSave={(e) => {
          e.preventDefault();
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
          void saveSection('payments', 'Payment methods', body);
        }}
      >
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
            Shown at checkout when the currency cookie is AED or USD, card payment is on, and
            keys are configured. Secret:{' '}
            {settings.stripeSecretKeySet ? 'configured' : 'not set'} (env fallback supported).
            Leave secret blank to keep the current value.
          </p>
          <div className="space-y-2">
            <Label>Stripe secret key</Label>
            <Input
              type="password"
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
            wallet ID are set. API key: {settings.konnectApiKeySet ? 'configured' : 'not set'}.
          </p>
          <div className="space-y-2">
            <Label>Konnect API key</Label>
            <Input
              type="password"
              autoComplete="off"
              value={secrets.konnectApiKey}
              onChange={(e) => setSecrets((s) => ({ ...s, konnectApiKey: e.target.value }))}
              placeholder="orgId:secret…"
            />
          </div>
          <div className="space-y-2">
            <Label>Konnect wallet ID</Label>
            <Input
              value={secrets.konnectWalletId}
              onChange={(e) => setSecrets((s) => ({ ...s, konnectWalletId: e.target.value }))}
              placeholder="receiverWalletId"
            />
          </div>
        </div>
      </Section>

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
        section="contact"
        title="Storefront contact"
        explanation="Contact details for this market window only. Leave a field blank to hide it on the storefront footer."
        onSave={(e) => {
          e.preventDefault();
          void saveSection('contact', 'Storefront contact', {
            contactWhatsapp: settings.contactWhatsapp,
            contactPhone: settings.contactPhone,
            contactFacebook: settings.contactFacebook,
            contactInstagram: settings.contactInstagram,
            contactEmail: settings.contactEmail,
          });
        }}
      >
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
