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
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type SectionId = 'tax' | 'inventory' | 'loyalty' | 'refunds';

function confirmSave(sectionLabel: string): boolean {
  return window.confirm(
    `Are you sure you want to save “${sectionLabel}”? This updates live storefront settings.`,
  );
}

export default function StoreSettingsPage() {
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
          Tax, inventory alerts, loyalty, and refund policy for this market. Each block saves on
          its own — no full page reload. Shipping, contact, and payments live under their own
          tabs. Money fields use minor units (100 = 1.00).
        </p>
        <SettingsSubnav className="mt-4" />
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
        section="refunds"
        title="Refund policy"
        explanation="Controls admin return refunds for captured card payments in this market. Pre-fulfillment (pending/processing) always refunds the full order total. Shipped/delivered orders use the rules below. Stripe is charged the computed amount unless overridden on the order."
        onSave={(e) => {
          e.preventDefault();
          void saveSection('refunds', 'Refund policy', {
            refundWindowDays: settings.refundWindowDays,
            refundWindowAfterShip: settings.refundWindowAfterShip,
            refundAllowedAfterShipped: settings.refundAllowedAfterShipped,
            refundAllowedAfterDelivered: settings.refundAllowedAfterDelivered,
            refundShippingRefundable: settings.refundShippingRefundable,
            refundTaxRefundable: settings.refundTaxRefundable,
            refundRestockingFeeBps: settings.refundRestockingFeeBps,
            refundDefaultPartialBps: settings.refundDefaultPartialBps,
          });
        }}
      >
        {numField(
          'refundWindowDays',
          'Refund window (days)',
          '0 = no time limit. Counted from delivery by default, or from ship if “Window starts at ship” is on.',
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.refundWindowAfterShip}
            onChange={(e) => toggle('refundWindowAfterShip', e.target.checked)}
          />
          Window starts at ship (otherwise delivery)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.refundAllowedAfterShipped}
            onChange={(e) => toggle('refundAllowedAfterShipped', e.target.checked)}
          />
          Allow refund while SHIPPED
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.refundAllowedAfterDelivered}
            onChange={(e) => toggle('refundAllowedAfterDelivered', e.target.checked)}
          />
          Allow refund while DELIVERED
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.refundShippingRefundable}
            onChange={(e) => toggle('refundShippingRefundable', e.target.checked)}
          />
          Shipping refundable on returns
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.refundTaxRefundable}
            onChange={(e) => toggle('refundTaxRefundable', e.target.checked)}
          />
          Tax refundable on returns (proportional)
        </label>
        {numField(
          'refundRestockingFeeBps',
          'Restocking fee (basis points of merchandise)',
          'Example: 1000 = 10% of refunded merchandise. Applied on returns only.',
        )}
        <div className="space-y-2">
          <Label htmlFor="refundDefaultPartialBps">
            Default merchandise refund (basis points, blank = 100%; 5000 = 50%)
          </Label>
          <p className="text-xs text-muted-foreground">
            Applied to (subtotal − discount) on shipped/delivered returns.
          </p>
          <Input
            id="refundDefaultPartialBps"
            value={settings.refundDefaultPartialBps ?? ''}
            onChange={(e) =>
              setSettings((prev) =>
                prev
                  ? {
                      ...prev,
                      refundDefaultPartialBps: e.target.value.trim()
                        ? Number(e.target.value) || 0
                        : null,
                    }
                  : prev,
              )
            }
          />
        </div>
      </Section>
    </div>
  );
}
