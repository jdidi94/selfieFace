const LOCALE_BY_CURRENCY: Record<string, string> = {
  USD: 'en-US',
  TND: 'fr-TN',
  AED: 'ar-AE',
};

/**
 * Format integer minor units for a market currency.
 * Example: formatMoney(4250, 'USD') => "$42.50"
 */
export function formatMoney(amount: number, currency = 'USD', locale?: string): string {
  const resolvedLocale = locale ?? LOCALE_BY_CURRENCY[currency] ?? 'en-US';
  if (resolvedLocale.startsWith('ar')) {
    const shorthand: Record<string, string> = { TND: 'د.ت', AED: 'د.إ', USD: 'د.أ' };
    const number = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
    return `${number} ${shorthand[currency] ?? currency}`;
  }
  return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(
    amount / 100,
  );
}

/** Rough region → currency defaults for storefront detection. */
export function currencyFromRegion(regionOrLang?: string | null): 'USD' | 'TND' | 'AED' {
  const value = (regionOrLang ?? '').toLowerCase();
  if (value.includes('tn') || value.includes('tunisia')) return 'TND';
  if (value.includes('ae') || value.includes('emirates') || value.includes('dubai')) return 'AED';
  return 'USD';
}

/** Cookie / cart currency → market window code. */
export function marketCodeFromCurrency(currency?: string | null): 'AE' | 'TN' | 'OTHER' {
  const code = (currency ?? 'USD').toUpperCase();
  if (code === 'AED') return 'AE';
  if (code === 'TND') return 'TN';
  return 'OTHER';
}

/** Market window → storefront currency. */
export function currencyFromMarketCode(market?: string | null): 'USD' | 'TND' | 'AED' {
  const code = (market ?? 'OTHER').toUpperCase();
  if (code === 'AE') return 'AED';
  if (code === 'TN') return 'TND';
  return 'USD';
}

/** Rough region / browser language → storefront locale. */
export function localeFromRegion(regionOrLang?: string | null): 'en' | 'ar' | 'fr' {
  const value = (regionOrLang ?? '').toLowerCase();
  if (value.startsWith('ar') || value.includes('-ae') || value.includes('arabic')) return 'ar';
  if (value.startsWith('fr') || value.includes('tunisia') || value.includes('-tn')) return 'fr';
  return 'en';
}

export function isRtlLocale(locale: string): boolean {
  return locale === 'ar';
}

export {
  ApiRequestError,
  parseApiErrorBody,
  throwApiError,
  type ParsedApiError,
} from './api-error';

export { FIELD_LABELS, fieldPathToLabel } from './field-labels';

export { resolveMediaUrl } from './media-url';
