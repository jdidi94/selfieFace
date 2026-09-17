'use client';

import { MARKET_BY_CURRENCY } from '@lumea/types';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { withMarketLocale } from '@/lib/market-path';
import Link, { type LinkProps } from 'next/link';
import type { ReactNode, AnchorHTMLAttributes } from 'react';

type Props = Omit<LinkProps, 'href'> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: string;
    children: ReactNode;
    locale?: string;
  };

/** Next Link that prefixes the active market + locale for SEO paths. */
export function LocaleLink({ href, locale: localeOverride, children, ...rest }: Props) {
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const loc = localeOverride ?? locale;
  const market = MARKET_BY_CURRENCY[currency];
  const prefixed =
    href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')
      ? href
      : withMarketLocale(market, loc, href);
  return (
    <Link href={prefixed} {...rest}>
      {children}
    </Link>
  );
}
