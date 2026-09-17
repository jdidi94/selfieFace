'use client';

import { BrandLogo } from '@/components/brand-logo';
import { getMessages } from '@/lib/messages';
import type { Locale } from '@lumea/types';

export function MarketUnavailable({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <BrandLogo variant="lockup" className="mb-8 justify-center" />
      <p className="font-display text-4xl text-foreground md:text-5xl">
        {t.marketUnavailableTitle}
      </p>
      <p className="mt-4 text-base text-muted-foreground md:text-lg">{t.marketUnavailableBody}</p>
    </main>
  );
}
