import { LocaleLink } from '@/components/locale-link';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const path = '/about';
  return {
    title: t.aboutTitle,
    description: t.aboutSubtitle,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title: t.aboutTitle,
      description: t.aboutSubtitle,
      url: localizedAbsoluteUrl(locale, path, market),
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default async function AboutPage() {
  const { locale } = await getStorefrontWindow();
  const t = getMessages(locale);

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display mb-2 text-4xl md:text-5xl">{t.aboutTitle}</h1>
        <p className="mb-10 text-muted-foreground">{t.aboutSubtitle}</p>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {t.aboutBody}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-sm">
          <LocaleLink href="/shop" className="underline underline-offset-2 hover:text-foreground">
            {t.browseShop}
          </LocaleLink>
          {' · '}
          <LocaleLink href="/contact" className="underline underline-offset-2 hover:text-foreground">
            {t.footerContact}
          </LocaleLink>
        </p>
      </div>
    </main>
  );
}
