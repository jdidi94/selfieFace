'use client';

import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  const t = getMessages(locale);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{t.errorTitle}</p>
      <h1 className="font-display mt-3 text-3xl text-foreground md:text-4xl">{t.errorPageTitle}</h1>
      <p className="mt-3 text-muted-foreground">{t.errorPageBody}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t.errorRetry}
        </button>
        <Link
          href="/shop"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm"
        >
          {t.backToShop}
        </Link>
      </div>
    </main>
  );
}
