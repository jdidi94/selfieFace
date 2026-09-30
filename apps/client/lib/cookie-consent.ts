'use client';

import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_COOKIE_LEGACY,
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_KEY_LEGACY,
  COOKIE_CONSENT_REOPEN_EVENT,
  clearDocumentCookie,
  readDocumentCookie,
  readStorageMigrating,
  writeDocumentCookie,
  writeStorageMigrating,
} from '@/lib/storefront-cookies';

export type CookieConsentChoice = 'all' | 'essential';

export { COOKIE_CONSENT_KEY, COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_REOPEN_EVENT };

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseCookieConsent(value: string | null | undefined): CookieConsentChoice | null {
  if (value === 'all' || value === 'essential') return value;
  return null;
}

/** Preference for analytics / behavior tracking (non-essential). */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'all';
}

export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = parseCookieConsent(
    readStorageMigrating(localStorage, COOKIE_CONSENT_KEY, COOKIE_CONSENT_KEY_LEGACY),
  );
  if (fromStorage) return fromStorage;
  const fromCookie =
    parseCookieConsent(readDocumentCookie(COOKIE_CONSENT_COOKIE)) ??
    parseCookieConsent(readDocumentCookie(COOKIE_CONSENT_COOKIE_LEGACY));
  if (fromCookie) {
    setCookieConsent(fromCookie);
    return fromCookie;
  }
  return null;
}

export function setCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === 'undefined') return;
  writeStorageMigrating(localStorage, COOKIE_CONSENT_KEY, COOKIE_CONSENT_KEY_LEGACY, choice);
  writeDocumentCookie(COOKIE_CONSENT_COOKIE, choice, MAX_AGE_SECONDS);
  clearDocumentCookie(COOKIE_CONSENT_COOKIE_LEGACY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }));
}

/** Clear stored preference and ask the banner to show again. */
export function clearCookieConsent() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(COOKIE_CONSENT_KEY_LEGACY);
  } catch {
    // ignore
  }
  clearDocumentCookie(COOKIE_CONSENT_COOKIE);
  clearDocumentCookie(COOKIE_CONSENT_COOKIE_LEGACY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_REOPEN_EVENT));
}

export function requestCookieConsentReopen() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_REOPEN_EVENT));
}
