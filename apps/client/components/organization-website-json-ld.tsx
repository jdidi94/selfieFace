import { absoluteUrl, localizedAbsoluteUrl } from '@/lib/seo';
import type { Locale, MarketCode } from '@lumea/types';

type OrganizationWebsiteJsonLdProps = {
  locale: Locale;
  market: MarketCode;
};

/**
 * Sitewide Organization + WebSite schema for rich results / Knowledge Graph hints.
 * SearchAction targets shop listing (`q`) when present.
 */
export function OrganizationWebsiteJsonLd({
  locale,
  market,
}: OrganizationWebsiteJsonLdProps) {
  const site = localizedAbsoluteUrl(locale, '/', market);
  const logoUrl = absoluteUrl('/brand/lockup-light.png');
  // Shop listing accepts `q` — keep `{search_term_string}` literal for SearchAction.
  const searchTarget = `${localizedAbsoluteUrl(locale, '/shop', market)}?q={search_term_string}`;

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}#organization`,
        name: 'Selfieface',
        url: site,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${site}#website`,
        name: 'Selfieface',
        url: site,
        publisher: { '@id': `${site}#organization` },
        inLanguage: locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: searchTarget,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
