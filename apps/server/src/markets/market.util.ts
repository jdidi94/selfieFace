import { MarketCode, type Currency } from '@lumea/types';
import { currencyFromMarketCode, marketCodeFromCurrency } from '@lumea/utils';
import { MarketCode as PrismaMarketCode, Currency as PrismaCurrency } from '@prisma/client';

export const ADMIN_MARKET_HEADER = 'x-market';
export const ADMIN_MARKET_COOKIE = 'admin_market';

export function parseMarketCode(value?: string | null): MarketCode {
  const code = (value ?? '').toUpperCase();
  if (code === MarketCode.AE) return MarketCode.AE;
  if (code === MarketCode.TN) return MarketCode.TN;
  return MarketCode.OTHER;
}

export function toPrismaMarketCode(code: MarketCode | string): PrismaMarketCode {
  const parsed = parseMarketCode(code);
  if (parsed === MarketCode.AE) return PrismaMarketCode.AE;
  if (parsed === MarketCode.TN) return PrismaMarketCode.TN;
  return PrismaMarketCode.OTHER;
}

export function marketCodeFromCurrencyValue(currency?: string | null): MarketCode {
  return parseMarketCode(marketCodeFromCurrency(currency));
}

export function currencyForMarket(code: MarketCode | string): Currency {
  return currencyFromMarketCode(code) as Currency;
}

export function toPrismaCurrency(currency: string): PrismaCurrency {
  const code = currency.toUpperCase();
  if (code === 'TND') return PrismaCurrency.TND;
  if (code === 'AED') return PrismaCurrency.AED;
  return PrismaCurrency.USD;
}

/** Catalog cache segment: catalog:AE | catalog:TN | catalog:OTHER */
export function catalogMarketTag(code: MarketCode | string): string {
  return `catalog:${parseMarketCode(code)}`;
}
