'use client';

import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { AddressDto } from '@lumea/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  toast,
} from '@lumea/ui';
import { useCallback, useEffect, useState } from 'react';

export function AccountAddressesForm() {
  const { accessToken, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [items, setItems] = useState<AddressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [fullName, setFullName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('TN');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setLabel('');
    setFullName('');
    setLine1('');
    setLine2('');
    setCity('');
    setRegion('');
    setPostalCode('');
    setCountry('TN');
    setPhone('');
    setIsDefault(false);
  }, []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await authFetch<AddressDto[]>('/customers/me/addresses', accessToken);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  function startEdit(addr: AddressDto) {
    setEditingId(addr.id);
    setLabel(addr.label ?? '');
    setFullName(addr.fullName);
    setLine1(addr.line1);
    setLine2(addr.line2 ?? '');
    setCity(addr.city);
    setRegion(addr.region ?? '');
    setPostalCode(addr.postalCode);
    setCountry(addr.country);
    setPhone(addr.phone ?? '');
    setIsDefault(addr.isDefault);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const body = {
        label: label.trim() || null,
        fullName: fullName.trim(),
        line1: line1.trim(),
        line2: null,
        city: city.trim(),
        region: null,
        postalCode: '',
        country: country.trim().toUpperCase(),
        phone: phone.trim() || null,
        isDefault,
      };
      if (editingId) {
        await authFetch(`/customers/me/addresses/${editingId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await authFetch('/customers/me/addresses', accessToken, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      toast.success(t.addressSaved);
      resetForm();
      await load();
    } catch {
      toast.error(t.addressSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    try {
      await authFetch(`/customers/me/addresses/${id}`, accessToken, { method: 'DELETE' });
      toast.success(t.addressDeleted);
      if (editingId === id) resetForm();
      await load();
    } catch {
      toast.error(t.addressDeleteFailed);
    }
  }

  async function makeDefault(id: string) {
    if (!accessToken) return;
    try {
      await authFetch(`/customers/me/addresses/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      });
      await load();
    } catch {
      toast.error(t.addressSaveFailed);
    }
  }

  if (authLoading || loading) {
    return <LoadingState label={t.loadingAddresses} />;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t.addressesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.addressesEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((addr) => (
                <li
                  key={addr.id}
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {addr.label || addr.fullName}
                        {addr.isDefault ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({t.addressDefault})
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {addr.fullName}
                        <br />
                        {addr.line1}
                        <br />
                        {addr.city}
                        <br />
                        {addr.country}
                        {addr.phone ? (
                          <>
                            <br />
                            {addr.phone}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!addr.isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void makeDefault(addr.id)}
                        >
                          {t.addressSetDefault}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(addr)}
                      >
                        {t.addressEdit}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void remove(addr.id)}
                      >
                        {t.addressDelete}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? t.addressEditTitle : t.addressAddTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void save(e)}>
            <div className="space-y-2">
              <Label htmlFor="addr-label">{t.addressLabel}</Label>
              <Input
                id="addr-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t.addressLabelPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr-name">{t.fullName}</Label>
              <Input
                id="addr-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr-line1">{t.address}</Label>
              <Input
                id="addr-line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="addr-city">{t.city}</Label>
                <Input
                  id="addr-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-country">{t.countryIso}</Label>
                <Input
                  id="addr-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr-phone">{t.phone}</Label>
              <Input
                id="addr-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              {t.addressDefault}
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? t.saving : editingId ? t.addressUpdate : t.addressAdd}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.cancel}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
