'use client';

import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { SUPPORTED_LOCALES, type CustomerProfileDto } from '@lumea/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@lumea/ui';
import { useCallback, useEffect, useState } from 'react';

type Labels = {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  preferredLocale: string;
  save: string;
  saved: string;
  none: string;
};

export function AccountProfileForm({ labels }: { labels: Labels }) {
  const { accessToken, loading: authLoading, user } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = getMessages(locale);
  const [profile, setProfile] = useState<CustomerProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<string>('none');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await authFetch<CustomerProfileDto>('/customers/me', accessToken);
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
      setPhone(data.phone ?? '');
      setPreferredLocale(data.preferredLocale ?? 'none');
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const updated = await authFetch<CustomerProfileDto>('/customers/me', accessToken, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
          preferredLocale: preferredLocale === 'none' ? null : preferredLocale,
        }),
      });
      setProfile(updated);
      if (updated.preferredLocale) setLocale(updated.preferredLocale);
      toast(labels.saved);
    } catch (err) {
      toast(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <LoadingState label={t.loadingProfile} />;
  }

  if (!user || !profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => void save(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">{labels.firstName}</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName">{labels.lastName}</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">{labels.phone}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{labels.preferredLocale}</Label>
            <Select value={preferredLocale} onValueChange={setPreferredLocale}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{labels.none}</SelectItem>
                {SUPPORTED_LOCALES.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Current session: {locale.toUpperCase()}
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {labels.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
