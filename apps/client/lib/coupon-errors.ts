import type { StorefrontMessages } from '@/lib/messages';

/** Map known API coupon errors to localized storefront copy. */
export function humanizeCouponError(
  message: string | null | undefined,
  t: StorefrontMessages,
): string {
  if (!message) return t.couponError;
  const key = message.trim();
  const map: Record<string, string> = {
    'This coupon code is invalid': t.couponInvalid,
    'Invalid coupon code': t.couponInvalid,
    'This coupon is not active': t.couponInactive,
    'Coupon is not active': t.couponInactive,
    'This coupon is not active yet': t.couponNotYet,
    'Coupon is not active yet': t.couponNotYet,
    'This coupon has expired': t.couponExpired,
    'Coupon has expired': t.couponExpired,
    'This coupon has reached its usage limit': t.couponLimit,
    'Coupon usage limit reached': t.couponLimit,
    'This coupon is not available in your currency': t.couponCurrency,
    'Coupon is not available in this currency': t.couponCurrency,
    'You have already used this coupon': t.couponAlreadyUsed,
    'This coupon does not apply to the products in your bag': t.couponProducts,
    'No cart items match this coupon’s product rules': t.couponProducts,
    "No cart items match this coupon's product rules": t.couponProducts,
    'Your bag total is below the minimum required for this coupon': t.couponMinimum,
    'Order subtotal is below the coupon minimum': t.couponMinimum,
  };
  return map[key] ?? key;
}
