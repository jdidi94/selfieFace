import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@prisma/client';
import { Locale as SharedLocale, MarketCode } from '@lumea/types';
import { brandUpsertSchema, localeSchema } from '@lumea/validation';
import {
  CACHE_PREFIX,
  CatalogCacheService,
} from '../common/cache/catalog-cache.service';
import { MarketsService } from '../markets/markets.service';
import {
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';
import { mapBrand, resolveBrandCopy } from '../products/product.mapper';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
    private readonly marketsService: MarketsService,
  ) {}

  async listPublic(locale = 'en', currency?: string) {
    const lang = localeSchema.safeParse(locale).success
      ? (locale as SharedLocale)
      : SharedLocale.EN;
    const marketCode = marketCodeFromCurrencyValue(currency);
    const market = await this.marketsService.getByCode(marketCode);
    return this.catalogCache.getOrSet(
      this.catalogCache.key(marketCode, CACHE_PREFIX.brands, lang),
      async () => {
        const rows = await this.prisma.brand.findMany({
          where: { marketId: market.id },
          include: { translations: true },
          orderBy: { name: 'asc' },
        });
        return rows.map((row) => mapBrand(row, lang));
      },
    );
  }

  async listAdmin(
    marketCode: MarketCode | string = MarketCode.OTHER,
    q?: string,
    limit = 50,
  ) {
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const term = q?.trim();
    const take = Math.min(Math.max(limit || 50, 1), 100);
    const rows = await this.prisma.brand.findMany({
      where: {
        marketId: market.id,
        ...(term
          ? {
              OR: [
                { id: term },
                { name: { contains: term, mode: 'insensitive' } },
                { slug: { contains: term, mode: 'insensitive' } },
                {
                  translations: {
                    some: { name: { contains: term, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      include: { translations: true },
      orderBy: { name: 'asc' },
      take: term ? take : undefined,
    });
    return rows.map((row) => mapBrand(row, SharedLocale.EN, true));
  }

  async create(input: unknown, marketCode: MarketCode | string = MarketCode.OTHER) {
    const parsed = brandUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const copy = resolveBrandCopy(parsed.data);
    const slug = parsed.data.slug ?? slugify(copy.name);
    try {
      const row = await this.prisma.brand.create({
        data: {
          name: copy.name,
          slug,
          description: copy.description,
          imageUrl: parsed.data.imageUrl ?? null,
          marketId: market.id,
          translations: {
            create: copy.translations.map((t) => ({
              locale: t.locale as Locale,
              name: t.name,
              description: t.description ?? null,
            })),
          },
        },
        include: { translations: true },
      });
      await this.catalogCache.invalidateCatalog(code);
      return mapBrand(row, SharedLocale.EN, true);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Brand slug already exists in this market');
      }
      throw err;
    }
  }

  async update(id: string, input: unknown) {
    const parsed = brandUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const existing = await this.prisma.brand.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Brand not found');

    const copy = resolveBrandCopy({
      name: parsed.data.name ?? existing.name,
      description:
        parsed.data.description !== undefined
          ? parsed.data.description
          : existing.description,
      translations: parsed.data.translations,
    });

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.brand.update({
          where: { id },
          data: {
            name: copy.name,
            slug: parsed.data.slug ?? existing.slug,
            description: copy.description,
            ...(parsed.data.imageUrl !== undefined
              ? { imageUrl: parsed.data.imageUrl }
              : {}),
          },
        });

        for (const t of copy.translations) {
          await tx.brandTranslation.upsert({
            where: {
              brandId_locale: {
                brandId: id,
                locale: t.locale as Locale,
              },
            },
            create: {
              brandId: id,
              locale: t.locale as Locale,
              name: t.name,
              description: t.description ?? null,
            },
            update: {
              name: t.name,
              description: t.description ?? null,
            },
          });
        }

        return tx.brand.findUniqueOrThrow({
          where: { id },
          include: { translations: true },
        });
      });

      await this.catalogCache.invalidateCatalog(existing.market.code);
      return mapBrand(row, SharedLocale.EN, true);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Brand slug already exists in this market');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.brand.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Brand not found');
    await this.prisma.brand.delete({ where: { id } });
    await this.catalogCache.invalidateCatalog(existing.market.code);
    return { success: true };
  }

  private isUniqueViolation(err: unknown) {
    return (
      typeof err === 'object' &&
      err != null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }
}
