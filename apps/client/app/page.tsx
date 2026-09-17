import { ApiHealth } from '@/components/api-health';
import { CategoriesCarousel } from '@/components/categories-carousel';
import { HomeHeroCarousel } from '@/components/home-hero-carousel';
import type { HomeHeroContent } from '@/components/home-hero';
import { HomeProductRailsSection } from '@/components/home-product-rails';
import { fetchApi, mediaUrl } from '@/lib/api';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import {
  PromoBannerPlacement,
  type CatalogCategory,
  type PromoBannerDto,
} from '@lumea/types';
import type { Metadata } from 'next';

export const revalidate = 300;

function staticHero(t: ReturnType<typeof getMessages>): HomeHeroContent {
  return {
    eyebrow: t.heroEyebrow,
    title: t.heroTitle,
    subtitle: t.heroSubtitle,
    ctaPrimary: t.heroCtaShop,
    ctaPrimaryHref: '/shop',
    ctaSecondary: t.heroCtaJournal,
    ctaSecondaryHref: '/journal',
  };
}

function heroFromBanner(
  banner: PromoBannerDto,
  t: ReturnType<typeof getMessages>,
): HomeHeroContent {
  return {
    eyebrow: banner.subtitle ?? t.heroEyebrow,
    title: banner.title,
    subtitle: '',
    ctaPrimary: banner.ctaLabel ?? t.heroCtaShop,
    ctaPrimaryHref: banner.href ?? '/shop',
    ctaSecondary: t.heroCtaJournal,
    ctaSecondaryHref: '/journal',
    imageUrl: mediaUrl(banner.imageUrl),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const title = 'Selfieface';
  const description = t.heroSubtitle;
  const url = localizedAbsoluteUrl(locale, '/', market);

  return {
    title,
    description,
    alternates: seoAlternates('/', locale, market),
    openGraph: {
      title,
      description,
      url,
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function HomePage() {
  const { locale, currency } = await getStorefrontWindow();
  const t = getMessages(locale);

  let heroSlides: HomeHeroContent[] = [staticHero(t)];
  let secondaryBanners: PromoBannerDto[] = [];
  let categories: CatalogCategory[] = [];
  try {
    const [heroBanners, secondary, cats] = await Promise.all([
      fetchApi<PromoBannerDto[]>(
        `/content/banners?placement=${PromoBannerPlacement.HOME_HERO}&locale=${locale}&currency=${currency}`,
      ),
      fetchApi<PromoBannerDto[]>(
        `/content/banners?placement=${PromoBannerPlacement.HOME_SECONDARY}&locale=${locale}&currency=${currency}`,
      ),
      fetchApi<CatalogCategory[]>(
        `/categories?locale=${locale}&currency=${currency}`,
      ).catch(() => [] as CatalogCategory[]),
    ]);
    if (heroBanners.length > 0) {
      heroSlides = heroBanners.map((b) => heroFromBanner(b, t));
    }
    secondaryBanners = secondary;
    categories = cats;
  } catch {
    // API unavailable — static hero
  }

  return (
    <main>
      <HomeHeroCarousel
        slides={heroSlides}
        secondaryCta={{ label: t.heroCtaJournal, href: '/journal' }}
      />
      {categories.length > 0 ? (
        <section className="border-t border-border px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl text-foreground md:text-4xl">
              {t.categoriesTitle}
            </h2>
            <CategoriesCarousel categories={categories} />
          </div>
        </section>
      ) : null}
      {secondaryBanners.length > 0 ? (
        <section className="border-t border-border px-6 py-12">
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryBanners.map((banner) => (
              <a
                key={banner.id}
                href={banner.href ?? '/shop'}
                className="group overflow-hidden rounded-sm border border-border bg-surface transition-colors hover:border-accent"
              >
                {banner.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(banner.imageUrl) ?? banner.imageUrl}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : null}
                <div className="p-5">
                  {banner.subtitle ? (
                    <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                      {banner.subtitle}
                    </p>
                  ) : null}
                  <p className="font-display mt-2 text-2xl">{banner.title}</p>
                  {banner.ctaLabel ? (
                    <span className="mt-4 inline-block text-sm font-medium underline-offset-4 group-hover:underline">
                      {banner.ctaLabel}
                    </span>
                  ) : null}
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <HomeProductRailsSection
        currency={currency}
        locale={locale}
        titles={{
          top: t.railTop,
          new: t.railNew,
          incoming: t.railIncoming,
          promotions: t.promotionsRail,
          topPacks: t.railTopPacks,
        }}
      />
      <section className="border-t border-border bg-surface-muted/40 px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <ApiHealth />
        </div>
      </section>
    </main>
  );
}
