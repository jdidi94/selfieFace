'use client';

import { BehaviorEventType, Currency, Locale } from '@lumea/types';
import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'lumea_behavior_batch';
const SESSION_KEY = 'lumea_behavior_session';
const CURRENCY_COOKIE = 'lumea_currency';
const MAX_BATCH = 80;
/** Same-origin BFF avoids CORS issues with sendBeacon. */
const BATCH_URL = '/api/behavior/batch';

type QueuedEvent = {
  type: BehaviorEventType;
  productId?: string | null;
  query?: string | null;
  locale?: Locale | null;
  currency?: Currency | null;
  path?: string | null;
  sessionId?: string | null;
  occurredAt?: string | null;
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

function parseCurrency(value: string | null | undefined): Currency {
  if (value === Currency.TND) return Currency.TND;
  if (value === Currency.AED) return Currency.AED;
  return Currency.USD;
}

function visitorCurrency(): Currency {
  return parseCurrency(readCookie(CURRENCY_COOKIE));
}

function readQueue(): QueuedEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BATCH)));
}

function sessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function enqueue(event: QueuedEvent) {
  const next = [
    ...readQueue(),
    {
      ...event,
      currency: event.currency ?? visitorCurrency(),
      sessionId: event.sessionId ?? sessionId(),
    },
  ];
  writeQueue(next);
}

export function trackProductClick(productId: string, locale?: Locale, path?: string) {
  enqueue({
    type: BehaviorEventType.PRODUCT_CLICK,
    productId,
    locale: locale ?? null,
    currency: visitorCurrency(),
    path: path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    occurredAt: new Date().toISOString(),
  });
}

export function trackSearch(query: string, locale?: Locale, path?: string) {
  const q = query.trim();
  if (!q) return;
  enqueue({
    type: BehaviorEventType.SEARCH,
    query: q,
    locale: locale ?? null,
    currency: visitorCurrency(),
    path: path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    occurredAt: new Date().toISOString(),
  });
}

export function flushBehaviorBatch() {
  if (typeof window === 'undefined') return;
  const events = readQueue();
  if (!events.length) return;

  writeQueue([]);
  const payload = JSON.stringify({
    events,
    currency: visitorCurrency(),
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const ok = navigator.sendBeacon(BATCH_URL, blob);
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch(BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    writeQueue([...events, ...readQueue()].slice(-MAX_BATCH));
  });
}

export function BehaviorCollector({ locale }: { locale: Locale }) {
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushBehaviorBatch();
    };
    const onPageHide = () => flushBehaviorBatch();
    const onBeforeUnload = () => flushBehaviorBatch();

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushBehaviorBatch();
    };
  }, []);

  return null;
}
