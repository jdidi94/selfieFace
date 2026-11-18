'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type HelpNote = { fieldKey: string; title: string; contentEn: string; contentAr?: string | null; contentFr?: string | null; isActive: boolean };
type HelpState = { enabled: boolean; notes: Map<string, HelpNote>; refresh: () => Promise<void> };
const Context = createContext<HelpState>({ enabled: false, notes: new Map(), refresh: async () => {} });

export function ContextualHelpProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const { market } = useAdminMarket();
  const [enabled, setEnabled] = useState(false);
  const [notes, setNotes] = useState<Map<string, HelpNote>>(new Map());
  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await adminFetch<{ enabled: boolean; items: HelpNote[] }>('/admin/help-notes', accessToken, { skipCache: true });
      setEnabled(data.enabled);
      setNotes(new Map(data.items.filter((item) => item.isActive).map((item) => [item.fieldKey, item])));
    } catch {
      setEnabled(false);
      setNotes(new Map());
    }
  }, [accessToken]);
  useEffect(() => { void refresh(); }, [refresh, market]);
  useEffect(() => {
    const update = () => { void refresh(); };
    window.addEventListener('admin-help-notes-updated', update);
    return () => window.removeEventListener('admin-help-notes-updated', update);
  }, [refresh]);
  const value = useMemo(() => ({ enabled, notes, refresh }), [enabled, notes, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function ContextualHelp({ fieldKey }: { fieldKey: string }) {
  const { enabled, notes } = useContext(Context);
  const [open, setOpen] = useState(false);
  const note = enabled ? notes.get(fieldKey) : undefined;
  if (!note) return null;
  const locale = typeof document === 'undefined' ? 'en' : document.documentElement.lang.toLowerCase().split('-')[0];
  const content = locale === 'ar' ? note.contentAr || note.contentEn : locale === 'fr' ? note.contentFr || note.contentEn : note.contentEn;
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" aria-label={`Help: ${note.title}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="ms-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-surface-muted">i</button>
      {open ? <span role="status" className="absolute start-0 top-7 z-40 w-64 rounded-md border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-foreground shadow-lg"><strong className="mb-1 block">{note.title}</strong>{content}</span> : null}
    </span>
  );
}
