'use client';

import { apiUrl } from '@/lib/api';
import type { StockNotifySubscribeResponse } from '@lumea/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function VerificationStatus() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    void fetch(`${apiUrl}/stock-notify/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) { setStatus('error'); return; }
        const result = await res.json() as StockNotifySubscribeResponse;
        if (result.productId) {
          try {
            window.localStorage.setItem(
              `stock-notify:${result.productId}:${result.variantId ?? 'all'}:guest`,
              'subscribed',
            );
          } catch { /* storage is optional */ }
        }
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [params]);
  const copy =
    status === 'loading'
      ? ['Confirming your request', 'Please wait a moment.']
      : status === 'success'
        ? ['You are on the list', 'We will email you when this product is available.']
        : [
            'This link is no longer valid',
            'Request another back-in-stock notification from the product page.',
          ];
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <h1 className="font-display text-3xl">{copy[0]}</h1>
      <p className="mt-3 text-muted-foreground">{copy[1]}</p>
      <Link href="/shop" className="mt-6 inline-block underline">
        Shop products
      </Link>
    </main>
  );
}

export default function VerifyStockNotificationPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-6 py-20" />}>
      <VerificationStatus />
    </Suspense>
  );
}
