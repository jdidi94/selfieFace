import { Currency, type Market } from '@prisma/client';
import { MarketCode } from '@lumea/types';
import { copyToMarketSchema } from '@lumea/validation';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseMarketCode } from '../markets/market.util';
import type { MarketsService } from '../markets/markets.service';

/** Approximate FX from USD for cloning prices into sibling market currencies. */
export const FX_FROM_USD: Record<string, number> = {
  USD: 1,
  TND: 3.1,
  AED: 3.67,
};

export function skuForMarket(baseSku: string, marketCode: string): string {
  const suffix = `-${marketCode}`;
  if (baseSku.endsWith(suffix)) return baseSku;
  const stripped = baseSku.replace(/-(AE|TN|OTHER)$/, '');
  return `${stripped}${suffix}`;
}

export function amountForCurrency(
  prices: { currency: Currency; amount: number; compareAtAmount: number | null }[],
  currency: Currency,
): { amount: number; compareAtAmount: number | null } {
  const hit = prices.find((p) => p.currency === currency);
  if (hit) return { amount: hit.amount, compareAtAmount: hit.compareAtAmount };

  const usd = prices.find((p) => p.currency === Currency.USD);
  if (usd) {
    const rate = FX_FROM_USD[currency] ?? 1;
    return {
      amount: Math.round(usd.amount * rate),
      compareAtAmount:
        usd.compareAtAmount != null ? Math.round(usd.compareAtAmount * rate) : null,
    };
  }

  const any = prices[0];
  if (!any) return { amount: 0, compareAtAmount: null };
  const fromUsd = FX_FROM_USD[any.currency] ?? 1;
  const toUsd = FX_FROM_USD[currency] ?? 1;
  const asUsd = any.amount / fromUsd;
  const compareAsUsd =
    any.compareAtAmount != null ? any.compareAtAmount / fromUsd : null;
  return {
    amount: Math.round(asUsd * toUsd),
    compareAtAmount: compareAsUsd != null ? Math.round(compareAsUsd * toUsd) : null,
  };
}

/** Convert a minor-unit amount between market currencies via USD. */
export function convertMinorBetweenCurrencies(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return amount;
  const fromRate = FX_FROM_USD[from] ?? 1;
  const toRate = FX_FROM_USD[to] ?? 1;
  return Math.round((amount / fromRate) * toRate);
}

export async function resolveCopyTarget(
  marketsService: MarketsService,
  input: unknown,
  sourceMarketCode: string,
): Promise<{ target: Market; sourceCode: MarketCode; targetCode: MarketCode }> {
  const parsed = copyToMarketSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

  const sourceCode = parseMarketCode(sourceMarketCode);
  const targetCode = parseMarketCode(parsed.data.targetMarket);
  if (targetCode === sourceCode) {
    throw new BadRequestException('Target market must differ from the source market');
  }

  const target = await marketsService.getByCode(targetCode);
  if (!target.enabled) {
    throw new ServiceUnavailableException({
      code: 'MARKET_DISABLED',
      message: `Target market ${targetCode} is disabled`,
      marketCode: target.code,
    });
  }

  return { target, sourceCode, targetCode };
}
