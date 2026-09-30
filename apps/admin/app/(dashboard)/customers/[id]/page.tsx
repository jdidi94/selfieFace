'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState } from '@/lib/validate-form';
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
import type { AdminCustomerDetailDto } from '@lumea/types';
import { formatMoney } from '@lumea/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<AdminCustomerDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<AdminCustomerDetailDto>(
        `/admin/customers/${params.id}`,
        accessToken,
        { skipCache: true },
      );
      setCustomer(result);
    } catch (e) {
      setCustomer(null);
      setError(submitErrorState(e).message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  async function setBlocked(block: boolean) {
    if (!accessToken || !params.id || !customer) return;

    if (block) {
      setBlockConfirmOpen(true);
      return;
    }

    const confirmed = window.confirm(
      `Unblock ${customer.email}? They will be able to sign in again, and will receive an email notice.`,
    );
    if (!confirmed) return;

    await applyBlock(false);
  }

  async function applyBlock(block: boolean) {
    if (!accessToken || !params.id) return;
    setActing(true);
    setError(null);
    try {
      const updated = await adminFetch<AdminCustomerDetailDto>(
        `/admin/customers/${params.id}/${block ? 'block' : 'unblock'}`,
        accessToken,
        { method: 'POST' },
      );
      setCustomer(updated);
      setBlockConfirmOpen(false);
    } catch (e) {
      setError(submitErrorState(e).message);
    } finally {
      setActing(false);
    }
  }

  if (authLoading || loading) return <LoadingState />;

  if (!customer) {
    return (
      <p className="text-muted-foreground">
        {error ?? 'Customer not found.'}{' '}
        <Link href="/customers" className="text-foreground underline">
          Back to list
        </Link>
      </p>
    );
  }

  const isBlocked = Boolean(customer.blockedAt);
  const canBlock = Boolean(customer.userId) && !customer.isGuest;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
            ← Customers
          </Link>
          <h1 className="font-display mt-2 text-3xl">{customer.email}</h1>
          {isBlocked ? (
            <Badge variant="outline" className="mt-2">
              Blocked {new Date(customer.blockedAt!).toLocaleString()}
            </Badge>
          ) : null}
        </div>
        {canBlock ? (
          <div className="flex gap-2">
            {isBlocked ? (
              <Button
                variant="outline"
                disabled={acting}
                onClick={() => void setBlocked(false)}
              >
                Unblock
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={acting}
                onClick={() => void setBlocked(true)}
              >
                Block
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{' '}
            {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span> {customer.phone ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Preferred locale:</span>{' '}
            {customer.preferredLocale?.toUpperCase() ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Preferred currency:</span>{' '}
            {customer.preferredCurrency ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Orders:</span> {customer.orderCount}
          </p>
          <p>
            <span className="text-muted-foreground">Loyalty balance:</span>{' '}
            {customer.loyaltyBalance != null ? customer.loyaltyBalance : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Joined:</span>{' '}
            {new Date(customer.createdAt).toLocaleString()}
          </p>
          {!canBlock ? (
            <p className="text-muted-foreground">
              Guest checkout records cannot be blocked (no account login).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {!customer.orders.length ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium hover:underline"
                        >
                          {order.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.status}</Badge>
                      </TableCell>
                      <TableCell>{formatMoney(order.total, order.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
        </CardHeader>
        <CardContent>
          {!customer.userId ? (
            <p className="text-sm text-muted-foreground">
              Guest customers have no linked user account, so product clicks and searches stay
              anonymous.
            </p>
          ) : !customer.behaviorEvents.length ? (
            <p className="text-sm text-muted-foreground">
              No attributed events yet. Behavior was previously anonymous (session only). Events
              appear here after this customer browses while signed in.
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.behaviorEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="secondary">{event.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {event.type === 'SEARCH'
                          ? event.query || '—'
                          : event.type === 'PAGE_VIEW'
                            ? event.path || '—'
                            : event.productId || event.path || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmTypedDialog
        open={blockConfirmOpen}
        title="Block customer"
        description={`${customer.email} will not be able to sign in, and will receive an email notice.`}
        confirmLabel={typedConfirmToken(customer.email, 'BLOCK')}
        confirmValue={typedConfirmToken(customer.email, 'BLOCK')}
        confirmButtonLabel="Block"
        onCancel={() => setBlockConfirmOpen(false)}
        onConfirm={() => applyBlock(true)}
      />
    </div>
  );
}
