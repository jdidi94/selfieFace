import type { Currency, Locale } from '@lumea/types';
import { formatMoney } from '@lumea/utils';

const arabicCurrencyLabels: Record<Currency, string> = {
  USD: 'دولار أمريكي',
  TND: 'دينار تونسي',
  AED: 'درهم إماراتي',
};

export function formatOrderMoney(amount: number, currency: Currency, locale: Locale) {
  return formatMoney(amount, currency, locale === 'ar' ? 'ar' : undefined);
}

export function orderCurrencyLabel(currency: Currency, locale: Locale) {
  return locale === 'ar' ? arabicCurrencyLabels[currency] : currency;
}
