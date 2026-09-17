import { ExpandableProductRail } from '@/components/expandable-product-rail';
import { fetchApi, mediaUrl } from '@/lib/api';
import type { Currency, HomeProductRails, Locale, ProductListItem } from '@lumea/types';

type HomeProductRailsProps = {
  currency: Currency;
  locale: Locale;
  titles: {
    top: string;
    new: string;
    incoming: string;
    promotions: string;
    topPacks: string;
  };
};

function withMedia(items: ProductListItem[]) {
  return items.map((item) => ({
    ...item,
    imageUrl: mediaUrl(item.imageUrl) ?? item.imageUrl,
    brand: item.brand
      ? {
          ...item.brand,
          imageUrl: mediaUrl(item.brand.imageUrl) ?? item.brand.imageUrl,
        }
      : item.brand,
  }));
}

export async function HomeProductRailsSection({
  currency,
  locale,
  titles,
}: HomeProductRailsProps) {
  let rails: HomeProductRails | null = null;
  let promoItems: ProductListItem[] = [];
  try {
    rails = await fetchApi<HomeProductRails>(
      `/merchandising/rails?currency=${currency}&locale=${locale}&limit=8`,
    );
    try {
      promoItems = await fetchApi<ProductListItem[]>(
        `/promotions/products?currency=${currency}&locale=${locale}&limit=8`,
      );
    } catch {
      promoItems = [];
    }
  } catch {
    return null;
  }

  if (!rails) return null;

  const sections: { key: string; title: string; items: ProductListItem[]; href?: string }[] = [
    { key: 'promotions', title: titles.promotions, items: promoItems, href: '/shop?promotion=1' },
    { key: 'topPacks', title: titles.topPacks, items: rails.topPacks ?? [], href: '/shop?kind=PACK' },
    { key: 'top', title: titles.top, items: rails.top, href: '/shop?recommended=1' },
    { key: 'new', title: titles.new, items: rails.new, href: '/shop' },
    { key: 'incoming', title: titles.incoming, items: rails.incoming, href: '/shop?incoming=1' },
  ].filter((s) => s.items.length > 0);

  if (!sections.length) return null;

  return (
    <div className="border-t border-border">
      {sections.map((section) => (
        <div key={section.key} className="border-b border-border last:border-b-0">
          <ExpandableProductRail
            title={section.title}
            items={withMedia(section.items)}
            seeAllHref={section.href}
            trackClicks
            locale={locale}
          />
        </div>
      ))}
    </div>
  );
}
