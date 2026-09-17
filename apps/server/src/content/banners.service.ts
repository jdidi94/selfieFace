import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Prisma } from '@prisma/client';
import { Locale as SharedLocale, type MarketCode } from '@lumea/types';
import {
  bannersQuerySchema,
  localeSchema,
  promoBannerUpsertSchema,
} from '@lumea/validation';
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
import { isBannerScheduleActive, mapPromoBanner } from './content.mapper';

const bannerInclude = {
  translations: true,
  imageMedia: true,
  market: true,
} satisfies Prisma.PromoBannerInclude;

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
    private readonly marketsService: MarketsService,
  ) {}

  private parseLocale(locale?: string): SharedLocale {
    return localeSchema.safeParse(locale).success
      ? (locale as SharedLocale)
      : SharedLocale.EN;
  }

  async listPublic(query: unknown) {
    const parsed = bannersQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { placement, locale, currency, market } = parsed.data;
    const lang = this.parseLocale(locale);
    const marketCode = market
      ? parseMarketCode(market)
      : marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);
    const cacheKey = this.catalogCache.key(
      marketCode,
      CACHE_PREFIX.banners,
      `${placement}:${lang}`,
    );

    return this.catalogCache.getOrSet(cacheKey, async () => {
      const now = new Date();
      const rows = await this.prisma.promoBanner.findMany({
        where: { placement, isActive: true, marketId: marketRow.id },
        include: bannerInclude,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      return rows
        .filter((row) => isBannerScheduleActive(row, now))
        .map((row) => mapPromoBanner(row, lang));
    });
  }

  async listAdmin(marketCode: MarketCode | string = 'OTHER') {
    const marketRow = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.promoBanner.findMany({
      where: { marketId: marketRow.id },
      include: bannerInclude,
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map((row) => mapPromoBanner(row, SharedLocale.EN, true));
  }

  async getAdmin(id: string) {
    const row = await this.prisma.promoBanner.findUnique({
      where: { id },
      include: bannerInclude,
    });
    if (!row) throw new NotFoundException('Banner not found');
    return mapPromoBanner(row, SharedLocale.EN, true);
  }

  async create(input: unknown, marketCode: MarketCode | string = 'OTHER') {
    const parsed = promoBannerUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);

    const row = await this.prisma.promoBanner.create({
      data: {
        placement: parsed.data.placement,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
        href: parsed.data.href ?? null,
        imageMediaId: parsed.data.imageMediaId ?? null,
        marketId: marketRow.id,
        startsAt: parsed.data.startsAt ?? null,
        endsAt: parsed.data.endsAt ?? null,
        translations: {
          create: parsed.data.translations.map((t) => ({
            locale: t.locale as Locale,
            title: t.title,
            subtitle: t.subtitle ?? null,
            ctaLabel: t.ctaLabel ?? null,
          })),
        },
      },
      include: bannerInclude,
    });
    await this.catalogCache.invalidateCatalog(code);
    return mapPromoBanner(row, SharedLocale.EN, true);
  }

  async update(id: string, input: unknown) {
    const parsed = promoBannerUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.promoBanner.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Banner not found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.promoBanner.update({
        where: { id },
        data: {
          placement: parsed.data.placement,
          isActive: parsed.data.isActive ?? existing.isActive,
          sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
          href: parsed.data.href !== undefined ? parsed.data.href : existing.href,
          imageMediaId:
            parsed.data.imageMediaId !== undefined
              ? parsed.data.imageMediaId
              : existing.imageMediaId,
          startsAt:
            parsed.data.startsAt !== undefined ? parsed.data.startsAt : existing.startsAt,
          endsAt: parsed.data.endsAt !== undefined ? parsed.data.endsAt : existing.endsAt,
        },
      });

      for (const t of parsed.data.translations) {
        await tx.promoBannerTranslation.upsert({
          where: {
            bannerId_locale: { bannerId: id, locale: t.locale as Locale },
          },
          create: {
            bannerId: id,
            locale: t.locale as Locale,
            title: t.title,
            subtitle: t.subtitle ?? null,
            ctaLabel: t.ctaLabel ?? null,
          },
          update: {
            title: t.title,
            subtitle: t.subtitle ?? null,
            ctaLabel: t.ctaLabel ?? null,
          },
        });
      }

      return tx.promoBanner.findUniqueOrThrow({
        where: { id },
        include: bannerInclude,
      });
    });

    await this.catalogCache.invalidateCatalog(existing.market?.code);
    return mapPromoBanner(row, SharedLocale.EN, true);
  }

  async remove(id: string) {
    const existing = await this.prisma.promoBanner.findUnique({
      where: { id },
      include: { market: true },
    });
    await this.prisma.promoBanner.delete({ where: { id } });
    await this.catalogCache.invalidateCatalog(existing?.market?.code);
    return { success: true };
  }
}
