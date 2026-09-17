'use client';

import { apiUrl } from '@/lib/api';
import {
  clearPendingPayment,
  getStripe,
  orderAuthHeaders,
} from '@/lib/stripe';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useTheme } from '@/lib/theme-context';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { Button } from '@lumea/ui';
import { useMemo, useState, type FormEvent } from 'react';

type CheckoutPaymentFormProps = {
  orderId: string;
  clientSecret: string;
  publishableKey?: string | null;
  accessToken?: string | null;
  guestAccessToken?: string | null;
  onPaid: (orderId: string) => void;
  onError?: (message: string) => void;
};

function PaymentFormInner({
  orderId,
  accessToken,
  guestAccessToken,
  onPaid,
  onError,
}: Omit<CheckoutPaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finalizeOnServer(paymentIntentId: string) {
    const res = await fetch(`${apiUrl}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers: orderAuthHeaders({ accessToken, guestAccessToken }),
      body: JSON.stringify({ paymentIntentId }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? t.paymentFailed);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    setError(null);

    const returnUrl = `${window.location.origin}/checkout/confirmation?orderId=${encodeURIComponent(orderId)}`;

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        throw new Error(result.error.message ?? t.paymentFailed);
      }

      const intent = result.paymentIntent;
      if (!intent) {
        return;
      }

      if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
        throw new Error(t.paymentFailed);
      }

      await finalizeOnServer(intent.id);
      clearPendingPayment();
      onPaid(orderId);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.paymentFailed;
      setError(message);
      onError?.(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!stripe || !elements || pending} className="w-full">
        {pending ? t.confirmingPayment : t.payNow}
      </Button>
    </form>
  );
}

export function CheckoutPaymentForm(props: CheckoutPaymentFormProps) {
  const { theme } = useTheme();
  const stripePromise = useMemo(() => getStripe(props.publishableKey), [props.publishableKey]);
  const appearance = useMemo<StripeElementsOptions['appearance']>(
    () =>
      theme === 'dark'
        ? {
            theme: 'night',
            variables: {
              colorPrimary: '#381F43',
              colorBackground: '#1c1916',
              colorText: '#f3efe8',
              colorDanger: '#c96b6b',
              colorTextSecondary: '#a39a8c',
              borderRadius: '6px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
            },
          }
        : {
            theme: 'stripe',
            variables: {
              colorPrimary: '#171512',
              colorBackground: '#ffffff',
              colorText: '#171512',
              colorDanger: '#8b3a3a',
              colorTextSecondary: '#6f6a61',
              borderRadius: '6px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
            },
          },
    [theme],
  );

  const options = useMemo<StripeElementsOptions>(
    () => ({
      clientSecret: props.clientSecret,
      appearance,
    }),
    [props.clientSecret, appearance],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentFormInner
        orderId={props.orderId}
        accessToken={props.accessToken}
        guestAccessToken={props.guestAccessToken}
        onPaid={props.onPaid}
        onError={props.onError}
      />
    </Elements>
  );
}
