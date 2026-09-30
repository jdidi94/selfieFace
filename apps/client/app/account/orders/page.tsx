'use client';

import { LocaleLink } from '@/components/locale-link';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { orderStatusLabel } from '@/lib/order-labels';
import { formatOrderMoney } from '@/lib/order-money';
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import type { OrderDto } from '@lumea/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function AccountOrdersPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const data = await authFetch<OrderDto[]>('/orders/me', accessToken);
    setOrders(data);
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/account/login');
      return;
    }
    if (!authLoading && accessToken) void load();
  }, [authLoading, user, accessToken, load, router]);

  if (authLoading || loading) return <LoadingState label={t.loadingOrders} />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl text-foreground">{t.ordersTitle}</h1>
        <Button variant="outline" asChild>
          <Link href="/account">{t.account}</Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={t.ordersEmptyTitle}
          description={t.ordersEmptyDescription}
          action={
            <Button asChild>
              <LocaleLink href="/shop">{t.browseShop}</LocaleLink>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.orderCol}</TableHead>
                <TableHead>{t.statusCol}</TableHead>
                <TableHead className="text-end">{t.totalCol}</TableHead>
                <TableHead>{t.dateCol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/account/orders/${order.id}`} className="font-medium hover:underline">
                      {order.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{orderStatusLabel(order.status, t)}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {formatOrderMoney(order.total, order.currency, locale)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString(locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
