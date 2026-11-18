import type { Currency, Locale } from '@lumea/types';
import { formatMoney } from '@lumea/utils';

const arabicCurrencyLabels: Record<Currency, string> = {
  USD: 'د.أ',
  TND: 'د.ت',
  AED: 'د.إ',
};

export function formatOrderMoney(amount: number, currency: Currency, locale: Locale) {
  return formatMoney(amount, currency, locale === 'ar' ? 'ar' : undefined);
}

export function orderCurrencyLabel(currency: Currency, locale: Locale) {
  return locale === 'ar' ? arabicCurrencyLabels[currency] : currency;
}
