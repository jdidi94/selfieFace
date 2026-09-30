'use client';

import { CheckoutPaymentForm } from '@/components/checkout-payment-form';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { bannerCtaPrimaryClassName } from '@/lib/brand-cta';
import { useCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages, type StorefrontMessages } from '@/lib/messages';
import {
  clearPendingPayment,
  getOrCreateCheckoutIdempotencyKey,
  getStripePublishableKey,
  readPendingPayment,
  storeGuestOrderToken,
  storePendingPayment,
} from '@/lib/stripe';
import type {
  AddressDto,
  CheckoutTotalsDto,
  LegalDocumentDto,
  OrderDto,
  PaymentOptionsDto,
} from '@lumea/types';
import { PaymentProvider } from '@lumea/types';
import { formatMoney, parseApiErrorBody } from '@lumea/utils';
import { Button, ErrorState, Input, Label, LoadingState, cn } from '@lumea/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

type Step = 'contact' | 'address' | 'delivery' | 'payment';

type AddressFieldErrors = {
  fullName?: string;
  line1?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
};

const CHECKOUT_COUNTRIES = [
  'TN',
  'FR',
  'DZ',
  'MA',
  'BE',
  'DE',
  'IT',
  'ES',
  'GB',
  'US',
  'AE',
  'SA',
  'CA',
  'CH',
] as const;

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required ? (
        <span className="ms-1 text-destructive" aria-hidden>
          *
        </span>
      ) : null}
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

function validateContactFields(
  t: StorefrontMessages,
  values: { fullName: string; phone: string; email: string },
): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (values.fullName.trim().length < 1) errors.fullName = t.enterFullName;
  if (values.phone.trim().length < 6) errors.phone = t.enterValidPhone;
  const emailTrimmed = values.email.trim();
  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.email = t.enterValidEmail;
  }
  return errors;
}

function validateAddressFields(
  t: StorefrontMessages,
  values: {
    fullName: string;
    line1: string;
    city: string;
    country: string;
    requireFullName: boolean;
  },
): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (values.requireFullName && values.fullName.trim().length < 1) {
    errors.fullName = t.enterFullName;
  }
  if (values.line1.trim().length < 1) errors.line1 = t.enterAddress;
  if (values.city.trim().length < 1) errors.city = t.enterCity;
  if (!/^[A-Z]{2}$/.test(values.country.trim().toUpperCase())) {
    errors.country = t.enterCountry;
  }
  return errors;
}

const STEPS_GUEST: Step[] = ['contact', 'address', 'delivery'];
const STEPS_AUTH: Step[] = ['address', 'delivery', 'payment'];

export default function CheckoutPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, error: cartError, refresh } = useCart();
  const { currency } = useCurrency();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const isGuest = !user;

  const steps = useMemo(() => (isGuest ? STEPS_GUEST : STEPS_AUTH), [isGuest]);
  const [step, setStep] = useState<Step>(isGuest ? 'contact' : 'address');

  const [pendingOrder, setPendingOrder] = useState<{
    id: string;
    number: string;
    clientSecret: string;
    total: number;
    currency: OrderDto['currency'];
    guestAccessToken?: string | null;
    publishableKey?: string | null;
  } | null>(null);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('TN');
  const [totals, setTotals] = useState<CheckoutTotalsDto | null>(null);
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'CARD'>('COD');
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionsDto | null>(null);
  const [checkoutLoadError, setCheckoutLoadError] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [policyDocuments, setPolicyDocuments] = useState<
    Partial<Record<'terms' | 'returns', LegalDocumentDto>>
  >({});

  const showAddressFields =
    isGuest || selectedAddressId === 'new' || savedAddresses.length === 0;

  const countryOptions = useMemo(() => {
    const codes = new Set<string>(CHECKOUT_COUNTRIES);
    if (country.trim()) codes.add(country.trim().toUpperCase());
    return Array.from(codes);
  }, [country]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      (['terms', 'returns'] as const).map(async (slug) => {
        const query = new URLSearchParams({ slug, locale, currency });
        const response = await fetch(`${apiUrl}/content/legal?${query.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) return [slug, null] as const;
        return [slug, (await response.json()) as LegalDocumentDto | null] as const;
      }),
    )
      .then((rows) => {
        if (active) setPolicyDocuments(Object.fromEntries(rows.filter((row) => row[1])));
      })
      .catch(() => {
        if (active) setPolicyDocuments({});
      });
    return () => {
      active = false;
    };
  }, [currency, locale]);

  useEffect(() => {
    if (!isGuest && step === 'contact') setStep('address');
  }, [isGuest, step]);

  useEffect(() => {
    if (isGuest || !accessToken) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      return;
    }
    void fetch(`${apiUrl}/customers/me/addresses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const list = (await res.json()) as AddressDto[];
        setSavedAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setFullName(preferred.fullName);
          setLine1(preferred.line1);
          setLine2(preferred.line2 ?? '');
          setCity(preferred.city);
          setRegion(preferred.region ?? '');
          setPostalCode(preferred.postalCode);
          setCountry(preferred.country);
          setPhone(preferred.phone ?? '');
        } else {
          setSelectedAddressId('new');
        }
      })
      .catch(() => undefined);
  }, [accessToken, isGuest]);

  useEffect(() => {
    void fetch(`${apiUrl}/checkout/payment-options?currency=${encodeURIComponent(currency)}`)
      .then(async (res) => {
        if (!res.ok) {
          setCheckoutLoadError(true);
          return;
        }
        const opts = (await res.json()) as PaymentOptionsDto;
        setPaymentOptions(opts);
        setCheckoutLoadError(false);
        if (opts.cashEnabled) setPaymentMethod('COD');
        else if (opts.cardEnabled) setPaymentMethod('CARD');
      })
      .catch(() => {
        setCheckoutLoadError(true);
      });
  }, [currency]);

  useEffect(() => {
    if (isGuest && paymentMethod === 'CARD' && paymentOptions?.cashEnabled) {
      setPaymentMethod('COD');
    }
  }, [isGuest, paymentMethod, paymentOptions?.cashEnabled]);

  useEffect(() => {
    if (authLoading || pendingOrder || paymentMethod !== 'CARD') return;
    if (isGuest && !paymentOptions?.cardEnabled) return;
    const stored = readPendingPayment();
    if (!stored) return;
    if (!isGuest && !accessToken) return;
    setPendingOrder({
      id: stored.orderId,
      number: '',
      clientSecret: stored.clientSecret,
      total: 0,
      currency,
      guestAccessToken: stored.guestAccessToken,
      publishableKey: paymentOptions?.stripePublishableKey,
    });
    setStep('payment');
  }, [
    accessToken,
    authLoading,
    pendingOrder,
    currency,
    isGuest,
    paymentMethod,
    paymentOptions?.cardEnabled,
    paymentOptions?.stripePublishableKey,
  ]);

  useEffect(() => {
    const countryCode = country.trim().toUpperCase();
    if (!cart?.id || countryCode.length !== 2 || (step !== 'address' && step !== 'delivery')) {
      return;
    }
    const guestToken =
      readCookie('selfieface_guest_token') ?? readCookie('lumea_guest_token');
    let cancelled = false;
    void fetch(`${apiUrl}/checkout/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cart-id': cart.id,
        ...(guestToken ? { 'x-guest-token': guestToken } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        cartId: cart.id,
        country: countryCode,
        currency,
        ...(shippingMethodId ? { shippingMethodId } : {}),
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const parsed = parseApiErrorBody(body, res.status);
          setError(parsed.message || t.quoteFailed);
          return;
        }
        const next = (await res.json()) as CheckoutTotalsDto;
        setTotals(next);
        setError(null);
        const selectedId = next.shipping.methodId ?? next.shippingMethods[0]?.id ?? null;
        if (selectedId && selectedId !== shippingMethodId) {
          setShippingMethodId(selectedId);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t.quoteFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, cart?.id, country, currency, shippingMethodId, step, t.quoteFailed]);

  function goNext() {
    const idx = steps.indexOf(step);
    if (idx >= 0 && idx < steps.length - 1) {
      setStep(steps[idx + 1]!);
      setError(null);
      setFieldErrors({});
    }
  }

  function goBack() {
    const idx = steps.indexOf(step);
    if (idx > 0) {
      setStep(steps[idx - 1]!);
      setError(null);
      setFieldErrors({});
    }
  }

  function validateCurrentAddress(): boolean {
    if (!showAddressFields) {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!selected || !/^[A-Z]{2}$/.test(selected.country.trim().toUpperCase())) {
        setError(t.addressIncomplete);
        return false;
      }
      setFieldErrors({});
      return true;
    }
    const nextErrors = validateAddressFields(t, {
      fullName,
      line1,
      city,
      country,
      requireFullName: !isGuest,
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(t.addressIncomplete);
      return false;
    }
    setError(null);
    return true;
  }

  async function placeOrder(method: 'COD' | 'CARD' = paymentMethod) {
    if (!cart) return;
    if (!acceptedPolicies) {
      setPolicyError(true);
      setError(t.checkoutPolicyRequired);
      return;
    }
    if (!validateCurrentAddress()) {
      setStep('address');
      return;
    }
    if (isGuest) {
      const contactErrors = validateContactFields(t, { fullName, phone, email });
      if (Object.keys(contactErrors).length > 0) {
        setFieldErrors(contactErrors);
        setError(
          contactErrors.email ??
            contactErrors.phone ??
            contactErrors.fullName ??
            t.checkoutFailed,
        );
        setStep('contact');
        return;
      }
    }
    if (!shippingMethodId) {
      setError(t.selectShippingMethod);
      return;
    }
    if (method === 'CARD' && isGuest) {
      setError(t.paymentCardRequiresAuth);
      router.push('/account/login?next=/checkout');
      return;
    }
    if (method === 'COD' && paymentOptions && !paymentOptions.cashEnabled) {
      setError(t.paymentCodDisabled);
      return;
    }
    if (method === 'CARD' && paymentOptions && !paymentOptions.cardEnabled) {
      setError(t.paymentCardDisabled);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const guestToken =
      readCookie('selfieface_guest_token') ?? readCookie('lumea_guest_token');
      const idempotencyKey = getOrCreateCheckoutIdempotencyKey(cart.id);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (guestToken) headers['x-guest-token'] = guestToken;

      const useSaved =
        !isGuest &&
        selectedAddressId &&
        selectedAddressId !== 'new' &&
        savedAddresses.some((a) => a.id === selectedAddressId);

      const body: Record<string, unknown> = {
        cartId: cart.id,
        currency,
        locale,
        acceptedPolicies: true,
        paymentMethod: method,
        shippingMethodId,
        idempotencyKey,
      };
      if (useSaved) {
        body.addressId = selectedAddressId;
      } else {
        body.shippingAddress = {
          fullName: fullName.trim(),
          line1: line1.trim(),
          line2: null,
          city: city.trim(),
          region: null,
          postalCode: '',
          country: country.trim().toUpperCase(),
          phone: phone.trim() || null,
        };
      }
      if (isGuest) {
        body.phone = phone.trim();
        if (email.trim()) body.email = email.trim();
      } else if (!useSaved && saveAddress) {
        body.saveAddress = true;
      }

      const res = await fetch(`${apiUrl}/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const parsed = parseApiErrorBody(errBody, res.status);
        throw new Error(parsed.message || t.checkoutFailed);
      }
      const order = (await res.json()) as OrderDto;

      if (order.guestAccessToken) {
        storeGuestOrderToken(order.id, order.guestAccessToken, order.number);
      }

      if (method === 'COD' || order.paymentProvider === PaymentProvider.COD) {
        clearPendingPayment();
        await refresh();
        router.push(`/checkout/confirmation?orderId=${order.id}`);
        return;
      }

      if (order.payUrl && order.paymentProvider === PaymentProvider.KONNECT) {
        clearPendingPayment();
        window.location.href = order.payUrl;
        return;
      }

      if (order.clientSecret) {
        const pk = paymentOptions?.stripePublishableKey || getStripePublishableKey();
        if (!pk) {
          throw new Error(t.stripeKeyMissing);
        }
        storePendingPayment({
          orderId: order.id,
          clientSecret: order.clientSecret,
          guestAccessToken: order.guestAccessToken,
        });
        setPendingOrder({
          id: order.id,
          number: order.number,
          clientSecret: order.clientSecret,
          total: order.total,
          currency: order.currency,
          guestAccessToken: order.guestAccessToken,
          publishableKey: pk,
        });
        setStep('payment');
        return;
      }

      throw new Error(t.checkoutFailed);
    } catch (err) {
      const message =
        err instanceof TypeError
          ? t.checkoutNetworkError
          : err instanceof Error
            ? err.message
            : t.checkoutFailed;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function onDeliveryContinue(e: FormEvent) {
    e.preventDefault();
    if (isGuest && (!paymentOptions?.cashEnabled || paymentMethod !== 'COD')) {
      setError(t.paymentCardRequiresAuth);
      router.push('/account/login?next=/checkout');
      return;
    }
    const method: 'COD' | 'CARD' =
      paymentMethod === 'COD' && paymentOptions?.cashEnabled
        ? 'COD'
        : paymentOptions?.cardEnabled
          ? 'CARD'
          : paymentMethod;
    await placeOrder(method);
  }

  async function onPaid(orderId: string) {
    clearPendingPayment();
    await refresh();
    router.push(`/checkout/confirmation?orderId=${orderId}`);
  }

  if (authLoading || cartLoading) return <LoadingState className="py-24" />;

  if (cartError || checkoutLoadError) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <ErrorState
          title={t.checkoutLoadErrorTitle}
          message={t.checkoutLoadErrorBody}
          action={
            <Button
              type="button"
              onClick={() => {
                setCheckoutLoadError(false);
                void refresh();
                void fetch(
                  `${apiUrl}/checkout/payment-options?currency=${encodeURIComponent(currency)}`,
                )
                  .then(async (res) => {
                    if (!res.ok) {
                      setCheckoutLoadError(true);
                      return;
                    }
                    setPaymentOptions((await res.json()) as PaymentOptionsDto);
                    setCheckoutLoadError(false);
                  })
                  .catch(() => setCheckoutLoadError(true));
              }}
            >
              {t.errorRetry}
            </Button>
          }
        />
      </main>
    );
  }

  if (step === 'payment' && pendingOrder) {
    return (
      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t.checkoutTitle}</p>
          <h1 className="mt-2 font-display text-4xl">{t.paymentTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.paymentSecure}
            {pendingOrder.number ? t.paymentForOrder(pendingOrder.number) : ''}.
            {pendingOrder.total > 0
              ? t.paymentTotal(formatMoney(pendingOrder.total, pendingOrder.currency))
              : ''}{' '}
            {t.taxIncludedInTotal}
          </p>
          <div className="mt-8 rounded-lg border border-border bg-surface p-6">
            <CheckoutPaymentForm
              orderId={pendingOrder.id}
              clientSecret={pendingOrder.clientSecret}
              publishableKey={pendingOrder.publishableKey}
              accessToken={accessToken}
              guestAccessToken={pendingOrder.guestAccessToken}
              onPaid={onPaid}
              onError={setError}
            />
          </div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
        <aside className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-display text-2xl">{t.almostDone}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t.almostDoneBody}</p>
        </aside>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-4xl">{t.checkoutTitle}</h1>
        <p className="mt-4 text-muted-foreground">{t.checkoutEmpty}</p>
        <Button className="mt-6" asChild>
          <Link href="/shop">{t.shop}</Link>
        </Button>
      </main>
    );
  }

  const stepLabel =
    step === 'contact'
      ? t.checkoutStepContact
      : step === 'address'
        ? t.checkoutStepAddress
        : step === 'delivery'
          ? t.checkoutStepDelivery
          : t.checkoutStepPayment;

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t.checkoutTitle} · {stepLabel}
        </p>
        <h1 className="mt-2 font-display text-4xl">{t.checkoutTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isGuest ? t.checkoutGuestHint : t.checkoutAuthHint(currency)}
        </p>
        {isGuest && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t.checkoutPreferAccount}{' '}
            <Link href="/account/login?next=/checkout" className="underline">
              {t.signIn}
            </Link>
          </p>
        )}

        {step === 'contact' && (
          <form
            className="mt-8 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const nextErrors = validateContactFields(t, { fullName, phone, email });
              setFieldErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                setError(
                  nextErrors.fullName ?? nextErrors.phone ?? nextErrors.email ?? null,
                );
                return;
              }
              goNext();
            }}
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="fullName" required>
                {t.fullName}
              </FieldLabel>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.fullName)}
                autoComplete="name"
              />
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="phone" required>
                {t.phoneNumber}
              </FieldLabel>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="+216…"
                aria-invalid={Boolean(fieldErrors.phone)}
                autoComplete="tel"
              />
              <FieldError message={fieldErrors.phone} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="guestEmail">{t.guestEmailOptional}</FieldLabel>
              <Input
                id="guestEmail"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
              />
              <FieldError message={fieldErrors.email} />
              <p className="text-xs text-muted-foreground">{t.guestEmailHint}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className={cn('w-full', bannerCtaPrimaryClassName)}>
              {t.continueToAddress}
            </Button>
          </form>
        )}

        {step === 'address' && (
          <form
            className="mt-8 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateCurrentAddress()) return;
              goNext();
            }}
          >
            {!isGuest && savedAddresses.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t.savedAddresses}</legend>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={selectedAddressId === addr.id}
                        onChange={() => {
                          setSelectedAddressId(addr.id);
                          setFullName(addr.fullName);
                          setLine1(addr.line1);
                          setLine2(addr.line2 ?? '');
                          setCity(addr.city);
                          setRegion(addr.region ?? '');
                          setPostalCode(addr.postalCode);
                          setCountry(addr.country);
                          setPhone(addr.phone ?? '');
                          setFieldErrors({});
                          setError(null);
                        }}
                      />
                      <span>
                        <span className="font-medium">
                          {addr.label || addr.fullName}
                          {addr.isDefault ? ` (${t.addressDefault})` : ''}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {addr.line1}, {addr.city}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={selectedAddressId === 'new'}
                      onChange={() => {
                        setSelectedAddressId('new');
                        setFieldErrors({});
                      }}
                    />
                    <span>{t.useNewAddress}</span>
                  </label>
                </div>
              </fieldset>
            )}

            {showAddressFields && (
              <>
                {!isGuest && (
                  <div className="space-y-2">
                    <FieldLabel htmlFor="fullNameAuth" required>
                      {t.fullName}
                    </FieldLabel>
                    <Input
                      id="fullNameAuth"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      autoComplete="name"
                    />
                    <FieldError message={fieldErrors.fullName} />
                  </div>
                )}
                <div className="space-y-2">
                  <FieldLabel htmlFor="line1" required>
                    {t.address}
                  </FieldLabel>
                  <Input
                    id="line1"
                    value={line1}
                    onChange={(e) => {
                      setLine1(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, line1: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.line1)}
                    autoComplete="address-line1"
                  />
                  <FieldError message={fieldErrors.line1} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="city" required>
                      {t.city}
                    </FieldLabel>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, city: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.city)}
                      autoComplete="address-level2"
                    />
                    <FieldError message={fieldErrors.city} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="country" required>
                      {t.countryIso}
                    </FieldLabel>
                    <select
                      id="country"
                      value={country.trim().toUpperCase() || 'TN'}
                      onChange={(e) => {
                        setCountry(e.target.value.toUpperCase());
                        setFieldErrors((prev) => ({ ...prev, country: undefined }));
                        setError(null);
                      }}
                      aria-invalid={Boolean(fieldErrors.country)}
                      autoComplete="country"
                      className="flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {countryOptions.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                    <FieldError message={fieldErrors.country} />
                  </div>
                </div>
                {!isGuest && (
                  <>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="phoneAuth">{t.phone}</FieldLabel>
                      <Input
                        id="phoneAuth"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                      />
                      {t.addressSaveOnCheckout}
                    </label>
                  </>
                )}
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              {steps.indexOf(step) > 0 && (
                <Button type="button" variant="outline" onClick={goBack}>
                  {t.back}
                </Button>
              )}
              <Button type="submit" className="flex-1">
                {t.continueToDelivery}
              </Button>
            </div>
          </form>
        )}

        {step === 'delivery' && (
          <form onSubmit={onDeliveryContinue} className="mt-8 space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{t.deliveryTo(country)}</p>
              <p className="mt-2 text-muted-foreground">
                {fullName}
                <br />
                {line1}
                <br />
                {city}
              </p>
              {isGuest && phone && (
                <p className="mt-2 text-muted-foreground">
                  {t.phone}: {phone}
                </p>
              )}

              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium text-foreground">{t.shippingMethod}</legend>
                {totals?.amountUntilFreeShipping != null &&
                totals.amountUntilFreeShipping > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t.freeShippingRemaining(
                      formatMoney(totals.amountUntilFreeShipping, currency),
                    )}
                  </p>
                ) : totals && totals.freeShippingThreshold > 0 ? (
                  <p className="text-xs text-muted-foreground">{t.freeShippingUnlocked}</p>
                ) : null}
                {(totals?.shippingMethods ?? []).map((method) => (
                  <label
                    key={method.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-3"
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={method.id}
                      checked={shippingMethodId === method.id}
                      onChange={() => setShippingMethodId(method.id)}
                      className="mt-1"
                    />
                    <span className="flex min-w-0 flex-1 justify-between gap-3">
                      <span>
                        <span className="block text-sm font-medium">{method.name}</span>
                        {method.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {method.description}
                          </span>
                        ) : null}
                        {method.estimatedDaysMin != null && method.estimatedDaysMax != null ? (
                          <span className="block text-xs text-muted-foreground">
                            {t.estimatedDays(method.estimatedDaysMin, method.estimatedDaysMax)}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm font-medium">
                        {method.freeShippingApplied
                          ? t.free
                          : formatMoney(method.amount, currency)}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="mt-4 flex justify-between border-t border-border pt-3">
                <span>{t.shipping}</span>
                <span>
                  {totals
                    ? totals.shipping.freeShippingApplied
                      ? t.free
                      : formatMoney(totals.shippingAmount, currency)
                    : '—'}
                </span>
              </div>
              <div className="mt-2 flex justify-between font-medium">
                <span>{t.orderTotal}</span>
                <span>
                  {formatMoney(
                    totals?.total ?? cart.total ?? cart.subtotal - (cart.discount ?? 0),
                    currency,
                  )}
                </span>
              </div>
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium text-foreground">{t.paymentMethod}</legend>
                {paymentOptions?.cashEnabled ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{t.paymentCod}</span>
                      <span className="text-xs text-muted-foreground">{t.paymentCodHint}</span>
                    </span>
                  </label>
                ) : null}
                {paymentOptions?.cardEnabled ? (
                  isGuest ? (
                    <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-3 text-sm">
                      <p className="font-medium text-foreground">{t.paymentCard}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.paymentCardRequiresAuth}
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <Link href="/account/login?next=/checkout">{t.signInToPayByCard}</Link>
                      </Button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="CARD"
                        checked={paymentMethod === 'CARD'}
                        onChange={() => setPaymentMethod('CARD')}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {t.paymentCard}
                          {paymentOptions.cardProvider === PaymentProvider.KONNECT
                            ? ` (${t.paymentViaKonnect})`
                            : paymentOptions.cardProvider === PaymentProvider.STRIPE
                              ? ` (${t.paymentViaStripe})`
                              : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.paymentCardHint}</span>
                      </span>
                    </label>
                  )
                ) : null}
                {!paymentOptions?.cashEnabled && !paymentOptions?.cardEnabled ? (
                  <p className="text-sm text-destructive">{t.paymentNoneAvailable}</p>
                ) : null}
              </fieldset>
              <div
                className={`mt-4 rounded-md border p-3 ${
                  policyError ? 'border-destructive' : 'border-border'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={acceptedPolicies}
                    onChange={(event) => {
                      setAcceptedPolicies(event.target.checked);
                      if (event.target.checked) {
                        setPolicyError(false);
                        setError(null);
                      }
                    }}
                    className="mt-1 size-4 shrink-0 accent-primary"
                    aria-invalid={policyError}
                  />
                  <span>{t.checkoutPolicyAcceptance}</span>
                </label>
                <details className="mt-3 border-t border-border pt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                    {t.checkoutPolicyDetails}
                  </summary>
                  <div className="mt-3 max-h-56 space-y-4 overflow-y-auto pe-2 text-muted-foreground">
                    {(['terms', 'returns'] as const).map((slug) => {
                      const document = policyDocuments[slug];
                      return (
                        <section key={slug}>
                          <h3 className="font-medium text-foreground">
                            {document?.title ?? (slug === 'terms' ? t.footerTerms : t.footerReturns)}
                          </h3>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                            {document?.content ??
                              (slug === 'terms'
                                ? t.checkoutTermsFallback
                                : t.checkoutReturnsFallback)}
                          </p>
                        </section>
                      );
                    })}
                  </div>
                </details>
                {policyError ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {t.checkoutPolicyRequired}
                  </p>
                ) : null}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="sticky bottom-0 z-10 -mx-6 flex gap-3 bg-background/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <Button type="button" variant="outline" className="h-auto min-h-12 shrink-0 px-5" onClick={goBack}>
                {t.back}
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  !shippingMethodId ||
                  (!paymentOptions?.cashEnabled && !paymentOptions?.cardEnabled) ||
                  (isGuest && !paymentOptions?.cashEnabled)
                }
                className="h-auto min-h-12 flex-1 whitespace-normal py-3 leading-tight"
              >
                {pending
                  ? t.placingOrder
                  : paymentMethod === 'COD' && paymentOptions?.cashEnabled
                    ? t.placeOrderCod
                    : paymentOptions?.cardProvider === PaymentProvider.KONNECT
                      ? t.continueToKonnect
                      : t.continueToPayment}
              </Button>
            </div>
          </form>
        )}
      </div>

      <aside className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">{t.orderSummary}</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>{formatMoney(item.lineTotal, cart.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span>{t.subtotal}</span>
            <span>{formatMoney(totals?.subtotal ?? cart.subtotal, currency)}</span>
          </div>
          {(totals?.discount ?? cart.discount ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t.discount}
                {(totals?.coupon ?? cart.coupon)?.code
                  ? ` (${(totals?.coupon ?? cart.coupon)?.code})`
                  : ''}
                {cart.loyalty && cart.loyalty.pointsToRedeem > 0
                  ? ` · ${t.loyaltyRedeemed(cart.loyalty.pointsToRedeem)}`
                  : ''}
              </span>
              <span>−{formatMoney(totals?.discount ?? cart.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t.shipping}</span>
            <span>
              {totals?.shipping.methodName ? `${totals.shipping.methodName} · ` : ''}
              {totals
                ? totals.shipping.freeShippingApplied
                  ? t.free
                  : formatMoney(totals.shippingAmount, currency)
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>
              {t.tax}
              {paymentOptions && paymentOptions.taxRateBps > 0
                ? ` (${(paymentOptions.taxRateBps / 100).toFixed(2)}%)`
                : ''}
            </span>
            <span>{totals ? formatMoney(totals.taxAmount, currency) : '—'}</span>
          </div>
          <div className="flex justify-between text-base font-medium">
            <span>{t.total}</span>
            <span>
              {formatMoney(
                totals?.total ?? cart.total ?? cart.subtotal - (cart.discount ?? 0),
                currency,
              )}
            </span>
          </div>
        </div>
      </aside>
    </main>
  );
}
