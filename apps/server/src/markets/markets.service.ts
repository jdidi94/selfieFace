import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketCode as PrismaMarketCode, type Market } from '@prisma/client';
import {
  Currency,
  MarketCode,
  type MarketDto,
} from '@lumea/types';
import { marketUpdateSchema } from '@lumea/validation';
import {
  CACHE_PREFIX,
  CatalogCacheService,
} from '../common/cache/catalog-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  currencyForMarket,
  marketCodeFromCurrencyValue,
  parseMarketCode,
  toPrismaMarketCode,
} from './market.util';

const MARKET_SEED: Array<{
  id: string;
  code: PrismaMarketCode;
  name: string;
  currency: Currency;
}> = [
  { id: 'market_ae', code: PrismaMarketCode.AE, name: 'Emirates', currency: Currency.AED },
  { id: 'market_tn', code: PrismaMarketCode.TN, name: 'Tunisia', currency: Currency.TND },
  {
    id: 'market_other',
    code: PrismaMarketCode.OTHER,
    name: 'Rest of world',
    currency: Currency.USD,
  },
];

@Injectable()
export class MarketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async ensureSeeded(): Promise<void> {
    for (const row of MARKET_SEED) {
      await this.prisma.market.upsert({
        where: { code: row.code },
        create: {
          id: row.id,
          code: row.code,
          name: row.name,
          currency: row.currency,
          enabled: true,
        },
        update: {
          name: row.name,
          currency: row.currency,
        },
      });
    }
  }

  async list(): Promise<MarketDto[]> {
    await this.ensureSeeded();
    const rows = await this.prisma.market.findMany({
      orderBy: { code: 'asc' },
    });
    return rows.map((m) => this.toDto(m));
  }

  async getByCode(code: MarketCode | string): Promise<Market> {
    await this.ensureSeeded();
    const prismaCode = toPrismaMarketCode(code);
    const market = await this.prisma.market.findUnique({ where: { code: prismaCode } });
    if (!market) throw new NotFoundException(`Market ${code} not found`);
    return market;
  }

  async getDtoByCode(code: MarketCode | string): Promise<MarketDto> {
    return this.toDto(await this.getByCode(code));
  }

  async resolveFromCurrency(currency?: string | null): Promise<MarketDto> {
    const code = marketCodeFromCurrencyValue(currency);
    return this.getDtoByCode(code);
  }

  async requireEnabledByCurrency(currency?: string | null): Promise<Market> {
    const market = await this.getByCode(marketCodeFromCurrencyValue(currency));
    if (!market.enabled) {
      throw new ServiceUnavailableException({
        code: 'MARKET_DISABLED',
        message: 'Service not available in your area',
        marketCode: market.code,
      });
    }
    return market;
  }

  async requireEnabledByCode(code: MarketCode | string): Promise<Market> {
    const market = await this.getByCode(code);
    if (!market.enabled) {
      throw new ServiceUnavailableException({
        code: 'MARKET_DISABLED',
        message: 'Service not available in your area',
        marketCode: market.code,
      });
    }
    return market;
  }

  async update(code: MarketCode | string, input: unknown): Promise<MarketDto> {
    const parsed = marketUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const market = await this.getByCode(code);
    const updated = await this.prisma.market.update({
      where: { id: market.id },
      data: { enabled: parsed.data.enabled },
    });
    await this.catalogCache.invalidateCatalog(parseMarketCode(updated.code));
    return this.toDto(updated);
  }

  async resolveId(code: MarketCode | string): Promise<string> {
    return (await this.getByCode(code)).id;
  }

  toDto(market: Market): MarketDto {
    return {
      id: market.id,
      code: parseMarketCode(market.code),
      name: market.name,
      currency: currencyForMarket(market.code),
      enabled: market.enabled,
    };
  }
}
