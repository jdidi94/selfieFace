'use client';

import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, LoadingState } from '@lumea/ui';
import type { CustomerProfileDto } from '@lumea/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type AdminCustomerDetail = CustomerProfileDto & {
  orderCount: number;
  createdAt: string;
  loyaltyBalance?: number | null;
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setLoading(true);
    const result = await adminFetch<AdminCustomerDetail>(
      `/admin/customers/${params.id}`,
      accessToken,
    );
    setCustomer(result);
    setLoading(false);
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [authLoading, accessToken, load]);

  if (authLoading || loading) return <LoadingState />;

  if (!customer) {
    return (
      <p className="text-muted-foreground">
        Customer not found.{' '}
        <Link href="/customers" className="text-foreground underline">
          Back to list
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Customers
        </Link>
        <h1 className="font-display mt-2 text-3xl">{customer.email}</h1>
      </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
