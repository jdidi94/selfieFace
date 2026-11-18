'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import type { StoreSettingsDto } from '@lumea/types';
import { Button, LoadingState } from '@lumea/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = { id: string; kind: string; title: string; body: string; actionUrl?: string | null; status: string; createdAt: string; source?: Record<string, unknown> | null };
type Feed = { items: Item[]; unreadCount: number };

export default function NotificationsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const [feed, setFeed] = useState<Feed>({ items: [], unreadCount: 0 });
  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    const [nextFeed, nextSettings] = await Promise.all([
      adminFetch<Feed>('/admin/notifications', accessToken, { skipCache: true }),
      adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { skipCache: true }),
    ]);
    setFeed(nextFeed); setSettings(nextSettings); setLoading(false);
  }
  useEffect(() => { if (!authLoading && accessToken) void load().catch((e) => { setError(e instanceof Error ? e.message : 'Unable to load reminders'); setLoading(false); }); }, [accessToken, authLoading, market]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('admin-notification-received', refresh);
    return () => window.removeEventListener('admin-notification-received', refresh);
  }, [accessToken, market]);

  async function setStatus(id: string, status: string) {
    if (!accessToken) return;
    setBusy(true);
    try { await adminFetch(`/admin/notifications/${id}`, accessToken, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); window.dispatchEvent(new Event('admin-notification-changed')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update reminder'); }
    finally { setBusy(false); }
  }
  async function toggleSetting(field: 'adminInsightsEnabled' | 'adminInsightEmailsEnabled') {
    if (!accessToken || !settings) return;
    const value = !settings[field];
    setBusy(true);
    try { const next = await adminFetch<StoreSettingsDto>('/admin/settings', accessToken, { method: 'PATCH', body: JSON.stringify({ [field]: value }) }); setSettings(next); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings'); }
    finally { setBusy(false); }
  }
  async function getAnalysis() {
    if (!accessToken) return;
    setBusy(true); setError('');
    try { const result = await adminFetch<{ provider: string; analysis: string }>('/admin/notifications/analyze', accessToken, { method: 'POST', body: JSON.stringify({}) }); setAnalysis(`${result.provider === 'grok' ? 'Grok analysis' : 'Current store signals'}\n${result.analysis}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to analyze store signals'); }
    finally { setBusy(false); }
  }
  if (authLoading || loading) return <LoadingState />;

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl">Store reminders</h1><p className="mt-1 text-sm text-muted-foreground">Actionable stock, catalog, and sales signals for {marketLabel(market)}.</p></div><Button onClick={() => void getAnalysis()} disabled={busy}>Interpret store activity</Button></div>
    {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p> : null}
    {analysis ? <section className="rounded-lg border border-accent/30 bg-accent/5 p-4"><div className="flex justify-between gap-3"><h2 className="font-medium">Strategy suggestions</h2><button onClick={() => setAnalysis('')} aria-label="Dismiss analysis" className="text-sm text-muted-foreground">Dismiss</button></div><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{analysis}</pre></section> : null}
    <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-border bg-surface p-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings?.adminInsightsEnabled ?? true} disabled={busy} onChange={() => void toggleSetting('adminInsightsEnabled')} />Generate store reminders</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings?.adminInsightEmailsEnabled ?? false} disabled={busy} onChange={() => void toggleSetting('adminInsightEmailsEnabled')} />Email daily digest</label>
      <p className="text-xs text-muted-foreground">Email requires SES and SES_ADMIN_NOTIFY_EMAIL (or ADMIN_NOTIFY_EMAIL) on the server.</p>
    </section>
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-medium">Open reminders</h2><span className="text-xs text-muted-foreground">{feed.unreadCount} open</span></div>
      {feed.items.length ? <div className="divide-y divide-border">{feed.items.map((item) => <article key={item.id} className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-accent uppercase">{item.kind.replaceAll('_', ' ')}</p><h3 className="mt-1 font-medium">{item.title}</h3><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{item.actionUrl ? <Button size="sm" variant="outline" asChild><Link href={item.actionUrl}>Review</Link></Button> : null}<Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus(item.id, 'SNOOZED')}>Remind tomorrow</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus(item.id, 'DISMISSED')}>Dismiss</Button></div></div>
      </article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No open reminders. We’ll surface useful stock, catalog, or sales signals here.</p>}
    </section>
  </div>;
}

function marketLabel(market: string) { return market === 'AE' ? 'UAE' : market === 'TN' ? 'Tunisia' : 'Other markets'; }
