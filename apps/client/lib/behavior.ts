'use client';

import { BehaviorEventType, Currency, Locale } from '@lumea/types';
import { useAuth } from '@/lib/auth-context';
import { hasAnalyticsConsent } from '@/lib/cookie-consent';
import {
  BEHAVIOR_BATCH_KEY,
  BEHAVIOR_BATCH_KEY_LEGACY,
  BEHAVIOR_SESSION_KEY,
  BEHAVIOR_SESSION_KEY_LEGACY,
  COOKIE_CONSENT_EVENT,
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_LEGACY,
  PREFERENCE_COOKIE_MAX_AGE,
  readCookieMigrating,
  readStorageMigrating,
  writeStorageMigrating,
} from '@/lib/storefront-cookies';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

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
  userId?: string | null;
  occurredAt?: string | null;
};

/** Module-level so track* helpers can attach userId without prop drilling. */
let currentUserId: string | null = null;

export function setBehaviorUserId(userId: string | null) {
  currentUserId = userId;
}

function parseCurrency(value: string | null | undefined): Currency {
  if (value === Currency.TND) return Currency.TND;
  if (value === Currency.AED) return Currency.AED;
  return Currency.USD;
}

function visitorCurrency(): Currency {
  return parseCurrency(
    readCookieMigrating(CURRENCY_COOKIE, CURRENCY_COOKIE_LEGACY, PREFERENCE_COOKIE_MAX_AGE),
  );
}

function readQueue(): QueuedEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = readStorageMigrating(
      sessionStorage,
      BEHAVIOR_BATCH_KEY,
      BEHAVIOR_BATCH_KEY_LEGACY,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]) {
  if (typeof window === 'undefined') return;
  writeStorageMigrating(
    sessionStorage,
    BEHAVIOR_BATCH_KEY,
    BEHAVIOR_BATCH_KEY_LEGACY,
    JSON.stringify(events.slice(-MAX_BATCH)),
  );
}

function sessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = readStorageMigrating(
    sessionStorage,
    BEHAVIOR_SESSION_KEY,
    BEHAVIOR_SESSION_KEY_LEGACY,
  );
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    writeStorageMigrating(
      sessionStorage,
      BEHAVIOR_SESSION_KEY,
      BEHAVIOR_SESSION_KEY_LEGACY,
      id,
    );
  }
  return id;
}

function enqueue(event: QueuedEvent) {
  if (!hasAnalyticsConsent()) return;
  const next = [
    ...readQueue(),
    {
      ...event,
      currency: event.currency ?? visitorCurrency(),
      sessionId: event.sessionId ?? sessionId(),
      userId: event.userId ?? currentUserId,
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

export function trackPageView(path?: string, locale?: Locale) {
  const resolvedPath =
    path ?? (typeof window !== 'undefined' ? window.location.pathname : null);
  if (!resolvedPath) return;
  enqueue({
    type: BehaviorEventType.PAGE_VIEW,
    locale: locale ?? null,
    currency: visitorCurrency(),
    path: resolvedPath.slice(0, 500),
    occurredAt: new Date().toISOString(),
  });
}

export function flushBehaviorBatch() {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) {
    writeQueue([]);
    return;
  }
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
  const { user } = useAuth();
  const pathname = usePathname();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    setBehaviorUserId(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    const onConsent = () => {
      if (!hasAnalyticsConsent()) {
        writeQueue([]);
        return;
      }
      if (pathname) {
        lastPathRef.current = null;
        trackPageView(pathname, localeRef.current);
      }
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, [pathname]);

  useEffect(() => {
    if (!hasAnalyticsConsent()) return;
    if (!pathname || pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    trackPageView(pathname, localeRef.current);
  }, [pathname]);

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
