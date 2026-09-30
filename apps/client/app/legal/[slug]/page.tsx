import { LocaleLink } from '@/components/locale-link';
import { fetchApi } from '@/lib/api';
import { loadLegalHtml, legalTitle, isLegalSlug, LEGAL_SLUGS } from '@/lib/legal-content';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { LegalDocumentDto } from '@lumea/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return { title: 'Legal' };
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const title = legalTitle(slug, locale);
  const path = `/legal/${slug}`;
  const description = `${title} — Selfieface (${t.footerLegal})`;
  return {
    title,
    description,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title,
      description,
      url: localizedAbsoluteUrl(locale, path, market),
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  let document: LegalDocumentDto | null = null;
  try {
    const query = new URLSearchParams({ slug, locale, currency: market === 'TN' ? 'TND' : market === 'AE' ? 'AED' : 'USD' });
    document = await fetchApi<LegalDocumentDto | null>(`/content/legal?${query.toString()}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
  } catch {
    document = null;
  }
  const html = document ? null : await loadLegalHtml(market, locale, slug);
  if (!document && !html) notFound();

  const title = document?.title ?? legalTitle(slug, locale);

  return (
    <main className="px-6 py-12">
      <article className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t.footerLegal}
        </p>
        <h1 className="font-display mt-2 text-4xl leading-tight md:text-5xl">{title}</h1>
        {document ? (
          <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
            {document.content}
          </div>
        ) : (
          <div
            className="legal-html mt-8 space-y-4 text-base leading-relaxed text-foreground/90 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-medium [&_li]:ms-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-2"
            dangerouslySetInnerHTML={{ __html: html ?? '' }}
          />
        )}
        <nav className="mt-12 border-t border-border pt-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <li>
              <LocaleLink href="/legal/privacy" className="hover:text-foreground">
                {t.footerPrivacy}
              </LocaleLink>
            </li>
            <li>
              <LocaleLink href="/legal/terms" className="hover:text-foreground">
                {t.footerTerms}
              </LocaleLink>
            </li>
            <li>
              <LocaleLink href="/legal/cookies" className="hover:text-foreground">
                {t.footerCookies}
              </LocaleLink>
            </li>
            <li>
              <LocaleLink href="/legal/shipping" className="hover:text-foreground">
                {t.footerShipping}
              </LocaleLink>
            </li>
            <li>
              <LocaleLink href="/legal/returns" className="hover:text-foreground">
                {t.footerReturns}
              </LocaleLink>
            </li>
          </ul>
        </nav>
      </article>
    </main>
  );
}
