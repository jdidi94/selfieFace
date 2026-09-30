import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const path = '/contact';
  return {
    title: t.contactTitle,
    description: t.contactSubtitle,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title: t.contactTitle,
      description: t.contactSubtitle,
      url: localizedAbsoluteUrl(locale, path, market),
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
