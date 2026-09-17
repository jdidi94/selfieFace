import { cookies } from 'next/headers';
import Link from 'next/link';
import { Locale } from '@lumea/types';
import { getMessages } from '@/lib/messages';

function parseLocale(value?: string): Locale {
  if (value === Locale.AR) return Locale.AR;
  if (value === Locale.FR) return Locale.FR;
  return Locale.EN;
}

export default async function NotFound() {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get('lumea_locale')?.value);
  const t = getMessages(locale);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">404</p>
      <h1 className="font-display mt-3 text-3xl text-foreground md:text-4xl">{t.notFoundTitle}</h1>
      <p className="mt-3 text-muted-foreground">{t.notFoundBody}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/shop"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t.shop}
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm"
        >
          {t.home}
        </Link>
      </div>
    </main>
  );
}
