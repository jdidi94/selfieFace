'use client';

import { LocaleLink } from '@/components/locale-link';
import { OrderStatusTimeline } from '@/components/order-status-timeline';
import { apiUrl } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import {
  orderAuthHeaders,
  readGuestOrderTokenByNumber,
  storeGuestOrderToken,
} from '@/lib/stripe';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import type { OrderDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function TrackInner() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getMessages(locale);

  const [orderNumber, setOrderNumber] = useState(searchParams.get('number') ?? '');
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [numberCopied, setNumberCopied] = useState(false);
  const [bothCopied, setBothCopied] = useState(false);

  useEffect(() => {
    const num = searchParams.get('number') ?? '';
    const tok = searchParams.get('token') ?? '';
    if (num) setOrderNumber(num);
    if (tok) {
      setToken(tok);
    } else if (num) {
      const saved = readGuestOrderTokenByNumber(num);
      if (saved) setToken(saved);
    }
  }, [searchParams]);

  useEffect(() => {
    const num = (searchParams.get('number') ?? '').trim();
    const tok =
      (searchParams.get('token') ?? '').trim() ||
      (num ? readGuestOrderTokenByNumber(num) : null);
    if (!num || !tok) return;
    void lookup(num, tok);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial deep-link only
  }, []);

  async function lookup(numberValue: string, tokenValue: string) {
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`${apiUrl}/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: numberValue.trim(),
          token: tokenValue.trim(),
        }),
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !token.trim()) {
      setError(t.trackOrderMissingFields);
      return;
    }
    void lookup(orderNumber, token);
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
      setOrder((await res.json()) as OrderDto);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.cancelFailed);
    } finally {
      setCancelling(false);
    }
  }

  async function copyToken() {
    if (!token.trim()) return;
    try {
      await navigator.clipboard.writeText(token.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyOrderNumber() {
    if (!orderNumber.trim()) return;
    try {
      await navigator.clipboard.writeText(orderNumber.trim());
      setNumberCopied(true);
      window.setTimeout(() => setNumberCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyBoth() {
    if (!orderNumber.trim() || !token.trim()) return;
    try {
      await navigator.clipboard.writeText(
        `${t.trackOrderNumber}: ${orderNumber.trim()}\n${t.trackOrderToken}: ${token.trim()}`,
      );
      setBothCopied(true);
      window.setTimeout(() => setBothCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function downloadTrackingDetails() {
    if (!orderNumber.trim() || !token.trim()) return;
    const body = [
      'Selfieface order tracking',
      '',
      `${t.trackOrderNumber}: ${orderNumber.trim()}`,
      `${t.trackOrderToken}: ${token.trim()}`,
    ].join('\n');
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selfieface-order-${orderNumber.trim()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canCancel =
    order?.canCancel ??
    (order &&
      (order.status === 'PENDING' || order.status === 'PROCESSING') &&
      order.paymentStatus !== 'CAPTURED');

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl text-foreground">{t.trackOrderTitle}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t.trackOrderSubtitle}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-border bg-surface p-6">
        <div className="space-y-2">
          <Label htmlFor="order-number">{t.trackOrderNumber}</Label>
          <div className="flex gap-2">
            <Input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="LM-…"
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={() => void copyOrderNumber()}>
              {numberCopied ? t.trackingDetailsCopied : t.copyOrderNumber}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-token">{t.trackOrderToken}</Label>
          <div className="flex gap-2">
            <Input
              id="order-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t.trackOrderTokenPlaceholder}
              autoComplete="off"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" onClick={() => void copyToken()}>
              {copied ? t.trackingDetailsCopied : t.copyAccessToken}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? t.loadingOrder : t.trackOrderLookup}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!orderNumber.trim() || !token.trim()}
            onClick={() => void copyBoth()}
          >
            {bothCopied ? t.trackingDetailsCopied : t.copyTrackingBoth}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!orderNumber.trim() || !token.trim()}
            onClick={downloadTrackingDetails}
          >
            {t.downloadTrackingDetails}
          </Button>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && !order ? <LoadingState className="mt-8" label={t.loadingOrder} /> : null}

      {order ? (
        <div className="mt-10 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-foreground">{order.number}</h2>
              <div className="mt-2 flex gap-2">
                <Badge>{order.status}</Badge>
                <Badge variant="outline">{order.paymentStatus}</Badge>
              </div>
            </div>
            {canCancel ? (
              <div className="max-w-xs space-y-2 text-end">
                <Button
                  variant="destructive"
                  disabled={cancelling}
                  onClick={() => void cancelOrder()}
                >
                  {cancelling ? t.cancelling : t.cancelOrder}
                </Button>
                <p className="text-xs text-muted-foreground">{t.cancelPolicyHint}</p>
              </div>
            ) : null}
          </div>

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
                        {formatMoney(item.lineTotal, order.currency)}
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
                {t.summary} ({order.currency})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span>{formatMoney(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.shipping}</span>
                <span>{formatMoney(order.shippingAmount, order.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <span>{t.total}</span>
                <span>{formatMoney(order.total, order.currency)}</span>
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
