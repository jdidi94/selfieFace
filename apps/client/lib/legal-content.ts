import { Locale, MarketCode, SUPPORTED_LOCALES, SUPPORTED_MARKET_CODES } from '@lumea/types';
import { readFile } from 'fs/promises';
import path from 'path';

export const LEGAL_SLUGS = ['privacy', 'terms', 'cookies', 'shipping', 'returns'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

const MARKET_DIR: Record<MarketCode, string> = {
  [MarketCode.AE]: 'ae',
  [MarketCode.TN]: 'tn',
  [MarketCode.OTHER]: 'other',
};

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'legal');

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function legalTitle(slug: LegalSlug, locale: Locale | string): string {
  const titles: Record<Locale, Record<LegalSlug, string>> = {
    [Locale.EN]: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      cookies: 'Cookie Policy',
      shipping: 'Shipping Policy',
      returns: 'Returns & Exchanges',
    },
    [Locale.FR]: {
      privacy: 'Politique de confidentialité',
      terms: 'Conditions générales',
      cookies: 'Politique cookies',
      shipping: 'Politique de livraison',
      returns: 'Retours et échanges',
    },
    [Locale.AR]: {
      privacy: 'سياسة الخصوصية',
      terms: 'شروط الخدمة',
      cookies: 'سياسة ملفات تعريف الارتباط',
      shipping: 'سياسة الشحن',
      returns: 'الإرجاع والاستبدال',
    },
  };
  const loc =
    locale === Locale.AR || locale === 'ar'
      ? Locale.AR
      : locale === Locale.FR || locale === 'fr'
        ? Locale.FR
        : Locale.EN;
  return titles[loc][slug];
}

async function tryRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Load editable HTML for a legal page.
 * Path: `content/legal/{market}/{locale}/{slug}.html`
 * Falls back to `other/{locale}` then `other/en` if a market/locale file is missing.
 */
export async function loadLegalHtml(
  market: MarketCode,
  locale: Locale | string,
  slug: LegalSlug,
): Promise<string | null> {
  const loc =
    locale === Locale.AR || locale === 'ar'
      ? 'ar'
      : locale === Locale.FR || locale === 'fr'
        ? 'fr'
        : 'en';
  const marketDir = MARKET_DIR[market] ?? 'other';

  const candidates = [
    path.join(CONTENT_ROOT, marketDir, loc, `${slug}.html`),
    path.join(CONTENT_ROOT, 'other', loc, `${slug}.html`),
    path.join(CONTENT_ROOT, 'other', 'en', `${slug}.html`),
  ];

  for (const candidate of candidates) {
    const html = await tryRead(candidate);
    if (html) return html;
  }
  return null;
}

export { SUPPORTED_LOCALES, SUPPORTED_MARKET_CODES, MARKET_DIR };
