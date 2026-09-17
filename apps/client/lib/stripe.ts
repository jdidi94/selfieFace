import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePublishableKey(override?: string | null): string | null {
  const key = override?.trim() || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

/** Singleton Stripe.js loader for Payment Element. */
export function getStripe(publishableKey?: string | null): Promise<Stripe | null> {
  const key = getStripePublishableKey(publishableKey);
  if (!key) return Promise.resolve(null);
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export const PENDING_PAYMENT_KEY = 'lumea_pending_payment';
export const GUEST_ORDER_TOKEN_KEY = 'lumea_guest_order_token';
/** Persists guest tokens by order number for later track lookup (survives session). */
export const GUEST_ORDER_TOKENS_KEY = 'lumea_guest_order_tokens';
export const CHECKOUT_IDEMPOTENCY_KEY = 'lumea_checkout_idempotency';

export type PendingPayment = {
  orderId: string;
  clientSecret: string;
  guestAccessToken?: string | null;
};

type StoredCheckoutIdempotency = { cartId: string; key: string };

/** Stable key for place-order retries for a given cart within a browser session. */
export function getOrCreateCheckoutIdempotencyKey(cartId: string): string {
  if (typeof window === 'undefined') return `srv-${cartId}-${Date.now()}`;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredCheckoutIdempotency;
      if (parsed.cartId === cartId && parsed.key?.length >= 8) return parsed.key;
    }
    const key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(
      CHECKOUT_IDEMPOTENCY_KEY,
      JSON.stringify({ cartId, key } satisfies StoredCheckoutIdempotency),
    );
    return key;
  } catch {
    return `ck-${cartId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function clearCheckoutIdempotencyKey() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
  } catch {
    // ignore
  }
}

export function storePendingPayment(payload: PendingPayment) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payload));
  if (payload.guestAccessToken) {
    sessionStorage.setItem(
      GUEST_ORDER_TOKEN_KEY,
      JSON.stringify({ orderId: payload.orderId, token: payload.guestAccessToken }),
    );
  }
}

export function readPendingPayment(): PendingPayment | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    if (!parsed.orderId || !parsed.clientSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeGuestOrderToken(
  orderId: string,
  token: string,
  orderNumber?: string | null,
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GUEST_ORDER_TOKEN_KEY, JSON.stringify({ orderId, token }));
  if (orderNumber) {
    try {
      const raw = localStorage.getItem(GUEST_ORDER_TOKENS_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[orderNumber] = token;
      localStorage.setItem(GUEST_ORDER_TOKENS_KEY, JSON.stringify(map));
    } catch {
      // ignore quota / private mode
    }
  }
}

export function readGuestOrderToken(orderId?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_ORDER_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orderId: string; token: string };
    if (!parsed.orderId || !parsed.token) return null;
    if (orderId && parsed.orderId !== orderId) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function readGuestOrderTokenByNumber(orderNumber: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_ORDER_TOKENS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[orderNumber] ?? null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  clearCheckoutIdempotencyKey();
}

export function orderAuthHeaders(opts: {
  accessToken?: string | null;
  guestAccessToken?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  if (opts.guestAccessToken) headers['x-guest-order-token'] = opts.guestAccessToken;
  return headers;
}
