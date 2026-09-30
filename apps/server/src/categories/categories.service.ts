import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@prisma/client';
import {
  Locale as SharedLocale,
  MarketCode,
  type CatalogCopyResult,
} from '@lumea/types';
import { categoryUpsertSchema, localeSchema } from '@lumea/validation';
import { resolveCopyTarget } from '../catalog/catalog-copy.util';
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
    const kind = parsed.data.kind ?? 'CATEGORY';
    const parentCategoryId = kind === 'PROBLEM' ? parsed.data.parentCategoryId : null;
    await this.assertParentCategory(parentCategoryId, market.id);
    try {
      const row = await this.prisma.category.create({
        data: {
          name: copy.name,
          slug,
          description: copy.description,
          sortOrder: parsed.data.sortOrder ?? 0,
          marketId: market.id,
          kind,
          parentCategoryId,
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
    const kind = parsed.data.kind ?? existing.kind;
    if (kind !== existing.kind) {
      const usage = await this.prisma.category.findUnique({
        where: { id },
        select: {
          _count: {
            select: { products: true, childCategories: true, problemProducts: true },
          },
        },
      });
      if (
        usage &&
        (usage._count.products > 0 ||
          usage._count.childCategories > 0 ||
          usage._count.problemProducts > 0)
      ) {
        throw new BadRequestException(
          'Remove product assignments and problem subcategories before changing this type',
        );
      }
    }
    const parentCategoryId =
      kind === 'PROBLEM'
        ? (parsed.data.parentCategoryId ?? existing.parentCategoryId)
        : null;
    if (kind === 'PROBLEM' && !parentCategoryId) {
      throw new BadRequestException('Choose a parent category for a problem');
    }
    await this.assertParentCategory(parentCategoryId, existing.marketId, id);

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
            kind,
            parentCategoryId,
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

  async copyToMarket(id: string, input: unknown): Promise<CatalogCopyResult> {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { translations: true, market: true },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const { target, sourceCode, targetCode } = await resolveCopyTarget(
      this.marketsService,
      input,
      existing.market.code,
    );

    const clash = await this.prisma.category.findUnique({
      where: { marketId_slug: { marketId: target.id, slug: existing.slug } },
    });
    if (clash) {
      throw new BadRequestException(
        `Category slug "${existing.slug}" already exists in ${targetCode}`,
      );
    }

    const created = await this.prisma.category.create({
      data: {
        name: existing.name,
        slug: existing.slug,
        description: existing.description,
        sortOrder: existing.sortOrder,
        marketId: target.id,
        translations: {
          create: existing.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description,
          })),
        },
      },
    });

    await this.catalogCache.invalidateCatalog(targetCode);
    return {
      id: created.id,
      type: 'category',
      sourceMarket: sourceCode,
      targetMarket: targetCode,
      warnings: [],
    };
  }

  private isUniqueViolation(err: unknown) {
    return (
      typeof err === 'object' &&
      err != null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  private async assertParentCategory(
    parentCategoryId: string | null | undefined,
    marketId: string,
    categoryId?: string,
  ) {
    if (!parentCategoryId) return;
    if (parentCategoryId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    const parent = await this.prisma.category.findUnique({
      where: { id: parentCategoryId },
      select: { marketId: true, kind: true },
    });
    if (!parent || parent.marketId !== marketId || parent.kind !== 'CATEGORY') {
      throw new BadRequestException('Choose a main category in this market');
    }
  }
}
