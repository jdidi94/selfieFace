'use client';

import { LocaleLink } from '@/components/locale-link';
import { OrderStatusTimeline } from '@/components/order-status-timeline';
import { apiUrl } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import {
  latestShippedNote,
  orderStatusLabel,
  paymentStatusLabel,
} from '@/lib/order-labels';
import { formatOrderMoney, orderCurrencyLabel } from '@/lib/order-money';
import {
  orderAuthHeaders,
  removeGuestOrderToken,
  storeGuestOrderToken,
} from '@/lib/stripe';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import { PaymentStatus, type OrderDto } from '@lumea/types';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function TrackInner() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getMessages(locale);

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const numberParam = (searchParams.get('number') ?? '').trim();
  const tokenParam = (searchParams.get('token') ?? '').trim();
  const emailParam = (searchParams.get('email') ?? '').trim();
  const hasMagicLink = Boolean(numberParam && tokenParam);
  const hasLegacyEmailLink = Boolean(numberParam && emailParam && !tokenParam);
  const hasDeepLink = hasMagicLink || hasLegacyEmailLink;

  useEffect(() => {
    if (hasMagicLink) {
      void lookup({ orderNumber: numberParam, token: tokenParam });
    } else if (hasLegacyEmailLink) {
      void lookup({ orderNumber: numberParam, email: emailParam });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once per query
  }, [numberParam, tokenParam, emailParam, hasMagicLink, hasLegacyEmailLink]);

  async function lookup(body: {
    orderNumber: string;
    token?: string;
    email?: string;
  }) {
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`${apiUrl}/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? t.trackOrderNotFound);
      }
      const data = (await res.json()) as OrderDto;
      setOrder(data);
      if (data.guestAccessToken) {
        storeGuestOrderToken(data.id, data.guestAccessToken, data.number);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder() {
    if (!order?.guestAccessToken) return;
    if (!window.confirm(t.cancelConfirm)) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: orderAuthHeaders({ guestAccessToken: order.guestAccessToken }),
        body: JSON.stringify({ note: 'Cancelled by guest' }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? t.cancelFailed);
      }
      const updated = (await res.json()) as OrderDto;
      setOrder(updated);
      removeGuestOrderToken(updated.id, updated.number);
      if (typeof window !== 'undefined') {
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}?number=${encodeURIComponent(updated.number)}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.cancelFailed);
    } finally {
      setCancelling(false);
    }
  }

  function trackAbsoluteUrl() {
    if (!order?.number || !order.guestAccessToken || typeof window === 'undefined') {
      return '';
    }
    const qs = `number=${encodeURIComponent(order.number)}&token=${encodeURIComponent(order.guestAccessToken)}`;
    return `${window.location.origin}${window.location.pathname}?${qs}`;
  }

  async function copyTrackLink() {
    const url = trackAbsoluteUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const canCancel =
    order?.canCancel ??
    (order &&
      (order.status === 'PENDING' || order.status === 'PROCESSING') &&
      order.paymentStatus !== 'CAPTURED');

  const canRequestRefund =
    !!order && order.paymentStatus === PaymentStatus.CAPTURED;
  const shippedNote = order ? latestShippedNote(order.timeline) : null;
  const refundHref = order
    ? `/contact?topic=REFUND&orderNumber=${encodeURIComponent(order.number)}${
        order.customerEmail
          ? `&email=${encodeURIComponent(order.customerEmail)}`
          : ''
      }`
    : '/contact';

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl text-foreground">{t.trackOrderTitle}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t.trackOrderSubtitle}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {t.trackOrderAccountHint}{' '}
        <LocaleLink
          href="/account/orders"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.trackOrderAccountCta}
        </LocaleLink>
      </p>

      {!hasDeepLink && !order ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
          {t.trackOrderNeedLink}
        </p>
      ) : null}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && !order ? <LoadingState className="mt-8" label={t.loadingOrder} /> : null}

      {order ? (
        <div className="mt-10 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-foreground">{order.number}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{orderStatusLabel(order.status, t)}</Badge>
                <Badge variant="outline">{paymentStatusLabel(order.paymentStatus, t)}</Badge>
              </div>
              {order.guestAccessToken ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyTrackLink()}
                  >
                    {linkCopied ? t.trackLinkCopied : t.copyTrackLink}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="max-w-xs space-y-2 text-end">
              {canCancel ? (
                <details className="text-start">
                  <summary className="cursor-pointer list-none text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                    {t.cancelOrderDisclosure}
                  </summary>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={cancelling}
                    onClick={() => void cancelOrder()}
                  >
                    {cancelling ? t.cancelling : t.cancelOrder}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">{t.cancelPolicyHint}</p>
                </details>
              ) : null}
              {canRequestRefund ? (
                <div className="space-y-1">
                  <Button variant="outline" asChild>
                    <LocaleLink href={refundHref}>{t.requestReturnRefund}</LocaleLink>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t.returnRefundNote}{' '}
                    <LocaleLink href="/legal/returns" className="underline underline-offset-2">
                      {t.footerReturns}
                    </LocaleLink>
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {shippedNote ? (
            <p className="rounded-md border border-border bg-surface-muted/40 px-4 py-3 text-sm">
              <span className="font-medium">{t.trackingNoteLabel}: </span>
              {shippedNote}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t.orderStatusTimeline}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusTimeline
                status={order.status}
                timeline={order.timeline}
                createdAt={order.createdAt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.items}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.product}</TableHead>
                    <TableHead className="text-end">{t.qty}</TableHead>
                    <TableHead className="text-end">{t.total}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.productName}
                        <span className="block text-xs text-muted-foreground">
                          {item.variantName}
                        </span>
                      </TableCell>
                      <TableCell className="text-end">{item.quantity}</TableCell>
                      <TableCell className="text-end">
                        {formatOrderMoney(item.lineTotal, order.currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t.summary} ({orderCurrencyLabel(order.currency, locale)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span>{formatOrderMoney(order.subtotal, order.currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.shipping}</span>
                <span>{formatOrderMoney(order.shippingAmount, order.currency, locale)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <span>{t.total}</span>
                <span>{formatOrderMoney(order.total, order.currency, locale)}</span>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" asChild>
            <LocaleLink href="/shop">{t.continueShopping}</LocaleLink>
          </Button>
        </div>
      ) : null}
    </main>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<LoadingState className="py-24" />}>
      <TrackInner />
    </Suspense>
  );
}
