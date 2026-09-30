/** Customer-facing cookie / storage keys (Selfieface). Legacy `lumea_*` names are migrated once. */

export const LOCALE_COOKIE = 'selfieface_locale';
export const LOCALE_COOKIE_LEGACY = 'lumea_locale';

export const CURRENCY_COOKIE = 'selfieface_currency';
export const CURRENCY_COOKIE_LEGACY = 'lumea_currency';

export const THEME_COOKIE = 'selfieface_theme';
export const THEME_COOKIE_LEGACY = 'lumea_theme';
export const THEME_STORAGE_KEY = 'selfieface_theme';
export const THEME_STORAGE_KEY_LEGACY = 'lumea_theme';

export const COOKIE_CONSENT_KEY = 'selfieface_cookie_consent';
export const COOKIE_CONSENT_KEY_LEGACY = 'lumea_cookie_consent';
export const COOKIE_CONSENT_COOKIE = 'selfieface_cookie_consent';
export const COOKIE_CONSENT_COOKIE_LEGACY = 'lumea_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'selfieface:cookie-consent';
export const COOKIE_CONSENT_REOPEN_EVENT = 'selfieface:cookie-consent-reopen';

export const CART_ID_COOKIE = 'selfieface_cart_id';
export const CART_ID_COOKIE_LEGACY = 'lumea_cart_id';
export const GUEST_TOKEN_COOKIE = 'selfieface_guest_token';
export const GUEST_TOKEN_COOKIE_LEGACY = 'lumea_guest_token';

export const PENDING_PAYMENT_KEY = 'selfieface_pending_payment';
export const PENDING_PAYMENT_KEY_LEGACY = 'lumea_pending_payment';
export const GUEST_ORDER_TOKEN_KEY = 'selfieface_guest_order_token';
export const GUEST_ORDER_TOKEN_KEY_LEGACY = 'lumea_guest_order_token';
export const GUEST_ORDER_TOKENS_KEY = 'selfieface_guest_order_tokens';
export const GUEST_ORDER_TOKENS_KEY_LEGACY = 'lumea_guest_order_tokens';
export const CHECKOUT_IDEMPOTENCY_KEY = 'selfieface_checkout_idempotency';
export const CHECKOUT_IDEMPOTENCY_KEY_LEGACY = 'lumea_checkout_idempotency';

export const BEHAVIOR_BATCH_KEY = 'selfieface_behavior_batch';
export const BEHAVIOR_BATCH_KEY_LEGACY = 'lumea_behavior_batch';
export const BEHAVIOR_SESSION_KEY = 'selfieface_behavior_session';
export const BEHAVIOR_SESSION_KEY_LEGACY = 'lumea_behavior_session';

export const COUPONS_BAR_DISMISS_KEY = 'selfieface_coupons_bar_dismissed';
export const COUPONS_BAR_DISMISS_KEY_LEGACY = 'lumea_coupons_bar_dismissed';

const YEAR = 60 * 60 * 24 * 365;
const MONTH = 60 * 60 * 24 * 30;

export function readDocumentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function writeDocumentCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = YEAR,
) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function clearDocumentCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/** Read new cookie, else legacy — migrate to new name when found. */
export function readCookieMigrating(
  name: string,
  legacyName: string,
  maxAgeSeconds: number = YEAR,
): string | null {
  const current = readDocumentCookie(name);
  if (current) return current;
  const legacy = readDocumentCookie(legacyName);
  if (!legacy) return null;
  writeDocumentCookie(name, legacy, maxAgeSeconds);
  clearDocumentCookie(legacyName);
  return legacy;
}

export function writeCookieMigrating(
  name: string,
  legacyName: string,
  value: string,
  maxAgeSeconds: number = YEAR,
) {
  writeDocumentCookie(name, value, maxAgeSeconds);
  clearDocumentCookie(legacyName);
}

export function readStorageMigrating(
  storage: Storage,
  key: string,
  legacyKey: string,
): string | null {
  try {
    const current = storage.getItem(key);
    if (current != null) return current;
    const legacy = storage.getItem(legacyKey);
    if (legacy == null) return null;
    storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

export function writeStorageMigrating(
  storage: Storage,
  key: string,
  legacyKey: string,
  value: string,
) {
  try {
    storage.setItem(key, value);
    storage.removeItem(legacyKey);
  } catch {
    // private mode / quota
  }
}

export function removeStorageMigrating(
  storage: Storage,
  key: string,
  legacyKey: string,
) {
  try {
    storage.removeItem(key);
    storage.removeItem(legacyKey);
  } catch {
    // ignore
  }
}

/** Server / middleware: prefer new cookie, fall back to legacy. */
export function pickCookieValue(
  get: (name: string) => string | undefined,
  name: string,
  legacyName: string,
): string | undefined {
  return get(name) ?? get(legacyName);
}

export const CART_COOKIE_MAX_AGE = MONTH;
export const PREFERENCE_COOKIE_MAX_AGE = YEAR;
