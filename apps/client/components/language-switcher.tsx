'use client';

import { Locale, MARKET_BY_CURRENCY } from '@lumea/types';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { stripMarketLocalePrefix, withMarketLocale } from '@/lib/market-path';
import { usePathname, useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { currency } = useCurrency();
  const market = MARKET_BY_CURRENCY[currency];
  const t = getMessages(locale);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="sr-only">{t.language}</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          setLocale(next);
          const bare = stripMarketLocalePrefix(pathname || '/');
          router.push(withMarketLocale(market, next, bare));
        }}
        className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground"
        aria-label={t.language}
      >
        <option value={Locale.EN}>EN</option>
        <option value={Locale.AR}>AR</option>
        <option value={Locale.FR}>FR</option>
      </select>
    </label>
  );
}
