import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@prisma/client';
import { Locale as SharedLocale, MarketCode } from '@lumea/types';
import { categoryUpsertSchema, localeSchema } from '@lumea/validation';
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
import { mapCategory, resolveCategoryCopy } from '../products/product.mapper';

@Injectable()
export class CategoriesService {
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
      this.catalogCache.key(marketCode, CACHE_PREFIX.categories, lang),
      async () => {
        const rows = await this.prisma.category.findMany({
          where: { marketId: market.id },
          include: { translations: true },
          orderBy: { sortOrder: 'asc' },
        });
        return rows.map((row) => mapCategory(row, lang));
      },
    );
  }

  async listAdmin(marketCode: MarketCode | string = MarketCode.OTHER) {
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const rows = await this.prisma.category.findMany({
      where: { marketId: market.id },
      include: { translations: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => mapCategory(row, SharedLocale.EN, true));
  }

  async create(input: unknown, marketCode: MarketCode | string = MarketCode.OTHER) {
    const parsed = categoryUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const copy = resolveCategoryCopy(parsed.data);
    const slug = parsed.data.slug ?? slugify(copy.name);
    try {
      const row = await this.prisma.category.create({
        data: {
          name: copy.name,
          slug,
          description: copy.description,
          sortOrder: parsed.data.sortOrder ?? 0,
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
      return mapCategory(row, SharedLocale.EN, true);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Category slug already exists in this market');
      }
      throw err;
    }
  }

  async update(id: string, input: unknown) {
    const parsed = categoryUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const copy = resolveCategoryCopy({
      name: parsed.data.name ?? existing.name,
      description:
        parsed.data.description !== undefined
          ? parsed.data.description
          : existing.description,
      translations: parsed.data.translations,
    });

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.category.update({
          where: { id },
          data: {
            name: copy.name,
            slug: parsed.data.slug ?? existing.slug,
            description: copy.description,
            sortOrder: parsed.data.sortOrder,
          },
        });

        for (const t of copy.translations) {
          await tx.categoryTranslation.upsert({
            where: {
              categoryId_locale: {
                categoryId: id,
                locale: t.locale as Locale,
              },
            },
            create: {
              categoryId: id,
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

        return tx.category.findUniqueOrThrow({
          where: { id },
          include: { translations: true },
        });
      });

      await this.catalogCache.invalidateCatalog(existing.market.code);
      return mapCategory(row, SharedLocale.EN, true);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('Category slug already exists in this market');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Category not found');
    await this.prisma.category.delete({ where: { id } });
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
