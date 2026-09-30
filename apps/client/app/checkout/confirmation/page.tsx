'use client';

import { CheckoutPaymentForm } from '@/components/checkout-payment-form';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { formatOrderMoney } from '@/lib/order-money';
import {
  clearPendingPayment,
  getStripePublishableKey,
  orderAuthHeaders,
  readGuestOrderToken,
  readPendingPayment,
  storeGuestOrderToken,
} from '@/lib/stripe';
import type { OrderDto } from '@lumea/types';
import { Button, LoadingState } from '@lumea/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LocaleLink } from '@/components/locale-link';
import { useCurrency } from '@/lib/currency-context';
import { withMarketLocale } from '@/lib/market-path';
import { MARKET_BY_CURRENCY } from '@lumea/types';

function ConfirmationInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const paymentIntentId = searchParams.get('payment_intent');
  const redirectStatus = searchParams.get('redirect_status');
  const provider = searchParams.get('provider');
  const { accessToken, loading: authLoading } = useAuth();
  const { refresh } = useCart();
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const market = MARKET_BY_CURRENCY[currency];
  const t = getMessages(locale);
  const router = useRouter();

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeSecret, setResumeSecret] = useState<string | null>(null);
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (authLoading || !orderId) return;

    const token =
      readGuestOrderToken(orderId) ??
      readPendingPayment()?.guestAccessToken ??
      null;
    if (!accessToken && !token) {
      setError(t.signInToViewOrder);
      return;
    }
    setGuestAccessToken(token);

    let cancelled = false;

    async function load() {
      const headers = orderAuthHeaders({
        accessToken,
        guestAccessToken: token,
      });

      try {
        if (provider === 'konnect') {
          setFinalizing(true);
          const confirmRes = await fetch(`${apiUrl}/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          });
          if (confirmRes.ok) {
            clearPendingPayment();
            await refresh();
            router.replace(`/checkout/confirmation?orderId=${orderId}`);
          }
        } else if (paymentIntentId && redirectStatus === 'succeeded') {
          setFinalizing(true);
          const confirmRes = await fetch(`${apiUrl}/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ paymentIntentId }),
          });
          if (!confirmRes.ok) {
            const err = (await confirmRes.json().catch(() => ({}))) as { message?: string };
            throw new Error(err.message ?? t.paymentFailed);
          }
          clearPendingPayment();
          await refresh();
          router.replace(`/checkout/confirmation?orderId=${orderId}`);
        } else if (paymentIntentId && redirectStatus && redirectStatus !== 'succeeded') {
          throw new Error(`Payment ${redirectStatus.replace(/_/g, ' ')}`);
        }

        const res = await fetch(`${apiUrl}/orders/${orderId}`, { headers });
        if (!res.ok) throw new Error(t.orderNotFound);
        const data = (await res.json()) as OrderDto;
        if (cancelled) return;
        setOrder(data);
        if (data.guestAccessToken) {
          storeGuestOrderToken(data.id, data.guestAccessToken, data.number);
          setGuestAccessToken(data.guestAccessToken);
        }

        if (
          data.paymentStatus === 'AUTHORIZED' ||
          data.paymentStatus === 'CAPTURED'
        ) {
          return;
        }

        if (data.paymentProvider === 'KONNECT' && data.konnectPaymentRef) {
          const confirmRes = await fetch(`${apiUrl}/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ paymentRef: data.konnectPaymentRef }),
          });
          if (confirmRes.ok) {
            clearPendingPayment();
            await refresh();
            const paidRes = await fetch(`${apiUrl}/orders/${orderId}`, { headers });
            if (paidRes.ok) setOrder((await paidRes.json()) as OrderDto);
            return;
          }
        }

        const stored = readPendingPayment();
        if (stored?.orderId === orderId && stored.clientSecret) {
          setResumeSecret(stored.clientSecret);
        } else if (getStripePublishableKey() && data.paymentProvider !== 'KONNECT') {
          const secretRes = await fetch(`${apiUrl}/orders/${orderId}/payment-secret`, {
            headers,
          });
          if (secretRes.ok) {
            const secret = (await secretRes.json()) as {
              clientSecret: string;
              alreadyPaid?: boolean;
            };
            if (secret.alreadyPaid) {
              clearPendingPayment();
              await refresh();
              const paidRes = await fetch(`${apiUrl}/orders/${orderId}`, { headers });
              if (paidRes.ok) {
                setOrder((await paidRes.json()) as OrderDto);
              }
              setResumeSecret(null);
            } else {
              setResumeSecret(secret.clientSecret);
            }
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.somethingWentWrong);
        }
      } finally {
        if (!cancelled) setFinalizing(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t strings stable per locale
  }, [
    accessToken,
    authLoading,
    orderId,
    paymentIntentId,
    provider,
    redirectStatus,
    refresh,
    router,
    locale,
  ]);

  async function onPaid(paidOrderId: string) {
    clearPendingPayment();
    await refresh();
    setResumeSecret(null);
    const headers = orderAuthHeaders({
      accessToken,
      guestAccessToken,
    });
    const res = await fetch(`${apiUrl}/orders/${paidOrderId}`, { headers });
    if (res.ok) {
      setOrder((await res.json()) as OrderDto);
    }
    router.replace(`/checkout/confirmation?orderId=${paidOrderId}`);
  }

  if (authLoading || finalizing || (!order && !error)) {
    return <LoadingState className="py-24" />;
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-4xl">{t.orderLabel}</h1>
        <p className="mt-4 text-destructive">{error ?? t.missingOrder}</p>
        <Button className="mt-6" asChild>
          <Link href="/shop">{t.backToShop}</Link>
        </Button>
      </main>
    );
  }

  const unpaid = order.paymentStatus !== 'CAPTURED';
  const isCod =
    order.paymentStatus === 'AUTHORIZED' && !order.clientSecret;
  const guestToken = guestAccessToken ?? order.guestAccessToken;
  const orderNumber = order.number;
  const trackHref = guestToken
    ? withMarketLocale(
        market,
        locale,
        `/orders/track?number=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(guestToken)}`,
      )
    : withMarketLocale(market, locale, '/orders/track');
  const trackAbsoluteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${trackHref}` : trackHref;

  async function copyTrackLink() {
    try {
      await navigator.clipboard.writeText(trackAbsoluteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl">
        {isCod ? t.thankYou : unpaid ? t.completePayment : t.thankYou}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {t.orderLabel} <span className="text-foreground">{order.number}</span>
        {isCod
          ? t.orderConfirmedCod
          : order.paymentStatus === 'CAPTURED'
            ? t.orderPaidProcessing
            : ` is ${order.paymentStatus.toLowerCase()}`}
        {!isCod && order.paymentStatus === 'CAPTURED' ? '.' : isCod ? '' : '.'}
      </p>

      {isCod && (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {t.paymentMethodCod} <span className="text-foreground">{t.paymentCod}</span>.{' '}
          {t.haveReady(formatOrderMoney(order.total, order.currency, locale))}
        </p>
      )}

      {!accessToken && guestToken ? (
        <div className="mt-6 space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium text-foreground">{t.guestTrackingTitle}</p>
          <p className="text-muted-foreground">{t.guestTrackingBody}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.trackOrderNumber}</span>
            <code className="max-w-full truncate rounded bg-surface-muted px-2 py-1 font-mono text-xs">
              {order.number}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyTrackLink()}>
              {linkCopied ? t.trackLinkCopied : t.copyTrackLink}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={trackHref}>{t.openTrackLink}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {unpaid && !isCod && resumeSecret && (accessToken || guestAccessToken) && (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <CheckoutPaymentForm
            orderId={order.id}
            clientSecret={resumeSecret}
            accessToken={accessToken}
            guestAccessToken={guestAccessToken}
            onPaid={onPaid}
            onError={setError}
          />
        </div>
      )}

      {unpaid && !isCod && !resumeSecret && (
        <p className="mt-6 text-sm text-destructive">
          {t.paymentOutstanding}{' '}
          <Link href="/checkout" className="underline">
            {t.checkout}
          </Link>{' '}
          {t.orContactSupport(order.number)}
        </p>
      )}

      <div className="mt-8 space-y-2 rounded-lg border border-border bg-surface p-6 text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4">
            <span>
              {item.productName} ({item.variantName}) × {item.quantity}
            </span>
            <span>{formatOrderMoney(item.lineTotal, order.currency, locale)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-3 font-medium">
          <span>{t.total}</span>
          <span>{formatOrderMoney(order.total, order.currency, locale)}</span>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <LocaleLink href="/shop">{t.continueShopping}</LocaleLink>
        </Button>
        {!accessToken && guestToken ? (
          <Button variant="outline" asChild>
            <Link href={trackHref}>{t.openTrackLink}</Link>
          </Button>
        ) : null}
        {accessToken ? (
          <Button variant="outline" asChild>
            <LocaleLink href="/account">{t.account}</LocaleLink>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <LocaleLink href="/account/register">{t.createAccount}</LocaleLink>
          </Button>
        )}
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<LoadingState className="py-24" />}>
      <ConfirmationInner />
    </Suspense>
  );
}
