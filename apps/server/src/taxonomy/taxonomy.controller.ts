import { Controller, Get, Query } from '@nestjs/common';
import { Locale } from '@prisma/client';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { CatalogCacheService, CACHE_PREFIX } from '../common/cache/catalog-cache.service';
import { marketCodeFromCurrencyValue } from '../markets/market.util';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma/prisma.service';

function localized<T extends { name: string; description: string | null; translations: { locale: Locale; name: string; description: string | null }[] }>(row: T, locale: Locale) {
  const translation = row.translations.find((item) => item.locale === locale);
  return { ...row, name: translation?.name ?? row.name, description: translation?.description ?? row.description, translations: undefined };
}

@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly prisma: PrismaService, private readonly markets: MarketsService, private readonly cache: CatalogCacheService) {}

  @Get()
  @HttpCache(300)
  async list(@Query('locale') locale = 'en', @Query('currency') currency = 'USD') {
    const lang = Object.values(Locale).includes(locale as Locale) ? locale as Locale : Locale.en;
    const code = marketCodeFromCurrencyValue(currency);
    const market = await this.markets.getByCode(code);
    return this.cache.getOrSet(this.cache.key(code, CACHE_PREFIX.taxonomy, lang), async () => {
      const [departments, productTypes, concerns, ingredients] = await Promise.all([
        this.prisma.department.findMany({ where: { marketId: market.id, isActive: true, products: { some: { marketId: market.id, status: 'ACTIVE', variants: { some: { isActive: true } } } } }, include: { translations: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
        this.prisma.productType.findMany({ where: { marketId: market.id, isActive: true, products: { some: { marketId: market.id, status: 'ACTIVE', variants: { some: { isActive: true } } } } }, include: { translations: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
        this.prisma.skinConcern.findMany({ where: { marketId: market.id, isActive: true, products: { some: { marketId: market.id, status: 'ACTIVE', variants: { some: { isActive: true } } } } }, include: { translations: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
        this.prisma.ingredient.findMany({ where: { marketId: market.id, isActive: true, products: { some: { marketId: market.id, status: 'ACTIVE', variants: { some: { isActive: true } } } } }, include: { translations: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      ]);
      return {
        departments: departments.map((row) => localized(row, lang)),
        productTypes: productTypes.map((row) => localized(row, lang)),
        concerns: concerns.map((row) => localized(row, lang)),
        ingredients: ingredients.map((row) => localized(row, lang)),
      };
    });
  }
}
