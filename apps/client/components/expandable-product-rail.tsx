'use client';

import { ShopProductGrid } from '@/components/shop-product-grid';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { Locale, ProductListItem } from '@lumea/types';
import { Button } from '@lumea/ui';
import Link from 'next/link';
import { useState } from 'react';

const INITIAL = 3;

export function ExpandableProductRail({
  title,
  items,
  seeAllHref,
  trackClicks,
  locale: localeProp,
}: {
  title: string;
  items: ProductListItem[];
  seeAllHref?: string;
  trackClicks?: boolean;
  locale?: Locale;
}) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const t = getMessages(locale);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL);
  const canExpand = items.length > INITIAL;

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl text-foreground md:text-4xl">{title}</h2>
          <div className="flex items-center gap-3">
            {canExpand ? (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? t.showFewerProducts : t.showMoreProducts}
              </Button>
            ) : null}
            {seeAllHref ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={seeAllHref}>{t.seeAll}</Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-8">
          <ShopProductGrid items={visible} trackClicks={trackClicks} locale={locale} />
        </div>
      </div>
    </section>
  );
}
