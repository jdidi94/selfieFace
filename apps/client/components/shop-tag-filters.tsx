'use client';

import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { shopFilterQuery, type ShopFilterValues } from '@/lib/shop-filters';
import Link from 'next/link';

export function ShopTagFilters({ values }: { values: ShopFilterValues }) {
  const { locale } = useLocale();
  const t = getMessages(locale);

  const tags: {
    key: string;
    label: string;
    active: boolean;
    href: string;
  }[] = [
    {
      key: 'packs',
      label: t.packsFilter,
      active: values.kind === 'PACK',
      href: `/shop?${shopFilterQuery({
        ...values,
        kind: values.kind === 'PACK' ? '' : 'PACK',
      }).toString()}`,
    },
    {
      key: 'promotion',
      label: t.promotionFilter,
      active: values.promotion,
      href: `/shop?${shopFilterQuery({ ...values, promotion: !values.promotion }).toString()}`,
    },
    {
      key: 'incoming',
      label: t.labelIncoming,
      active: values.incoming,
      href: `/shop?${shopFilterQuery({ ...values, incoming: !values.incoming }).toString()}`,
    },
    {
      key: 'recommended',
      label: t.recommended,
      active: values.recommended,
      href: `/shop?${shopFilterQuery({
        ...values,
        recommended: !values.recommended,
      }).toString()}`,
    },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label={t.applyFilters}>
      {tags.map((tag) => (
        <Link
          key={tag.key}
          href={tag.href}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            tag.active
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted-foreground hover:border-foreground/30'
          }`}
        >
          {tag.label}
        </Link>
      ))}
    </div>
  );
}
