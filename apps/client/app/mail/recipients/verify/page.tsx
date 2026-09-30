'use client';

import { apiUrl } from '@/lib/api';
import { Button } from '@lumea/ui';
import { useEffect, useState } from 'react';

export default function VerifyMailRecipientPage() {
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function confirmAddress() {
    if (!token || pending) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/mail/recipients/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'This verification link is invalid or expired.');
      }
      setVerified(true);
      setMessage('Email address verified. You can close this page.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify this email address.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-12">
      <section className="w-full space-y-4 rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-2xl">Verify alert email</h1>
        <p className="text-sm text-muted-foreground">
          Confirm this address to receive the store notifications requested by an administrator.
        </p>
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        {!verified ? (
          <Button onClick={() => void confirmAddress()} disabled={!token || pending}>
            {pending ? 'Verifying…' : 'Confirm email address'}
          </Button>
        ) : null}
      </section>
    </main>
  );
}
