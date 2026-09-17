'use client';

import { LocaleLink } from '@/components/locale-link';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { Button } from '@lumea/ui';

type EmptyCatalogCtasProps = {
  /** When true, include a clear-filters action that navigates to /shop. */
  showClearFilters?: boolean;
};

/** CTAs shown when search or shop filters return no products. */
export function EmptyCatalogCtas({ showClearFilters = false }: EmptyCatalogCtasProps) {
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild>
        <LocaleLink href="/shop">{t.browseShop}</LocaleLink>
      </Button>
      <Button variant="outline" asChild>
        <LocaleLink href="/shop?sort=name&order=asc">{t.emptyBrowseBestsellers}</LocaleLink>
      </Button>
      <Button variant="outline" asChild>
        <LocaleLink href="/search">{t.search}</LocaleLink>
      </Button>
      {showClearFilters ? (
        <Button variant="ghost" asChild>
          <LocaleLink href="/shop">{t.clearFilters}</LocaleLink>
        </Button>
      ) : null}
    </div>
  );
}
