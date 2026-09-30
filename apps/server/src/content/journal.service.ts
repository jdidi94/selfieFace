import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalArticleStatus, Locale, Prisma, ProductStatus } from '@prisma/client';
import {
  Currency as SharedCurrency,
  Locale as SharedLocale,
  type AdminJournalListResponse,
  type MarketCode,
  type ProductListItem,
} from '@lumea/types';
import {
  adminJournalListQuerySchema,
  journalArticleUpsertSchema,
  journalListQuerySchema,
  localeSchema,
} from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import {
  currencyForMarket,
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';
import { mapJournalDetail, mapJournalListItem } from './content.mapper';
import { mapProductListItem } from '../products/product.mapper';
import { ReviewsService } from '../reviews/reviews.service';

const articleInclude = {
  translations: true,
  coverMedia: true,
  market: true,
  gallery: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
  products: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      product: {
        include: {
          category: { include: { translations: true } },
          brand: { include: { translations: true } },
          market: true,
          variants: { include: { prices: true } },
          images: { include: { media: true } },
          translations: true,
          promotionProducts: { include: { promotion: true } },
        },
      },
    },
  },
} satisfies Prisma.JournalArticleInclude;

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly marketsService: MarketsService,
  ) {}

  private parseLocale(locale?: string): SharedLocale {
    return localeSchema.safeParse(locale).success
      ? (locale as SharedLocale)
      : SharedLocale.EN;
  }

  private async uniqueSlug(
    marketId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const root = slugify(base) || 'article';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.journalArticle.findUnique({
        where: { marketId_slug: { marketId, slug: candidate } },
        select: { id: true },
      });
      if (!existing || (excludeId && existing.id === excludeId)) return candidate;
      candidate = `${root}-${n}`;
      n += 1;
    }
  }

  private async assertProductsInMarket(productIds: string[], marketId: string) {
    if (!productIds.length) return;
    const found = await this.prisma.product.findMany({
      where: { id: { in: productIds }, marketId },
      select: { id: true },
    });
    if (found.length !== productIds.length) {
      throw new BadRequestException(
        'One or more recommended products are not in this market',
      );
    }
  }

  private async mapRecommended(
    row: Prisma.JournalArticleGetPayload<{ include: typeof articleInclude }>,
    locale: SharedLocale,
    currency: SharedCurrency = SharedCurrency.USD,
  ): Promise<ProductListItem[]> {
    const products = (row.products ?? [])
      .map((link) => link.product)
      .filter((p) => p.status === ProductStatus.ACTIVE);
    if (!products.length) return [];
    const ratings = await this.reviews.ratingSummariesForProducts(products.map((p) => p.id));
    return products.map((p) =>
      mapProductListItem(p, currency, locale, ratings.get(p.id) ?? null),
    );
  }

  private async toDetail(
    row: Prisma.JournalArticleGetPayload<{ include: typeof articleInclude }>,
    locale: SharedLocale,
    includeAll = false,
    currency: SharedCurrency = SharedCurrency.USD,
  ) {
    const recommended = await this.mapRecommended(row, locale, currency);
    return mapJournalDetail(row, locale, includeAll, recommended);
  }

  async listPublic(query: unknown) {
    const parsed = journalListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { locale, currency, market, page, pageSize } = parsed.data;
    const lang = this.parseLocale(locale);
    const marketCode = market
      ? parseMarketCode(market)
      : marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);
    const now = new Date();

    const where: Prisma.JournalArticleWhereInput = {
      marketId: marketRow.id,
      status: JournalArticleStatus.PUBLISHED,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    };

    const [rows, total] = await Promise.all([
      this.prisma.journalArticle.findMany({
        where,
        include: articleInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.journalArticle.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapJournalListItem(row, lang)),
      total,
      page,
      pageSize,
      locale: lang,
    };
  }

  async getBySlugPublic(slug: string, query: unknown) {
    const parsed = journalListQuerySchema
      .pick({ locale: true, currency: true, market: true })
      .safeParse(query ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { locale, currency, market } = parsed.data;
    const lang = this.parseLocale(locale);
    const marketCode = market
      ? parseMarketCode(market)
      : marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);
    const currencyCode = (currency ?? currencyForMarket(marketCode)) as SharedCurrency;
    const now = new Date();
    const row = await this.prisma.journalArticle.findFirst({
      where: {
        slug,
        marketId: marketRow.id,
        status: JournalArticleStatus.PUBLISHED,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      include: articleInclude,
    });
    if (!row) throw new NotFoundException('Article not found');
    return this.toDetail(row, lang, false, currencyCode);
  }

  async listAdmin(
    marketCode: MarketCode | string = 'OTHER',
    query: unknown = {},
  ): Promise<AdminJournalListResponse> {
    const parsed = adminJournalListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const marketRow = await this.marketsService.getByCode(marketCode);
    const currency = currencyForMarket(marketCode) as SharedCurrency;
    const where = { marketId: marketRow.id };
    const [total, rows] = await Promise.all([
      this.prisma.journalArticle.count({ where }),
      this.prisma.journalArticle.findMany({
        where,
        include: articleInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
      }),
    ]);
    const items = await Promise.all(
      rows.map((row) => this.toDetail(row, SharedLocale.EN, true, currency)),
    );
    return {
      items,
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.journalArticle.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!row) throw new NotFoundException('Article not found');
    const currency = currencyForMarket(row.market?.code ?? 'OTHER') as SharedCurrency;
    return this.toDetail(row, SharedLocale.EN, true, currency);
  }

  private async syncGallery(
    tx: Prisma.TransactionClient,
    articleId: string,
    mediaIds: string[] | undefined,
  ) {
    if (mediaIds === undefined) return;
    await tx.journalArticleImage.deleteMany({ where: { articleId } });
    if (!mediaIds.length) return;
    await tx.journalArticleImage.createMany({
      data: mediaIds.map((mediaId, index) => ({
        articleId,
        mediaId,
        sortOrder: index,
      })),
    });
  }

  private async syncProducts(
    tx: Prisma.TransactionClient,
    articleId: string,
    productIds: string[] | undefined,
  ) {
    if (productIds === undefined) return;
    await tx.journalArticleProduct.deleteMany({ where: { articleId } });
    if (!productIds.length) return;
    const unique = [...new Set(productIds)];
    await tx.journalArticleProduct.createMany({
      data: unique.map((productId, index) => ({
        articleId,
        productId,
        sortOrder: index,
      })),
    });
  }

  async create(input: unknown, marketCode: MarketCode | string = 'OTHER') {
    const parsed = journalArticleUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);
    const currency = currencyForMarket(code) as SharedCurrency;
    const en = parsed.data.translations.find((t) => t.locale === 'en');
    const slug = await this.uniqueSlug(marketRow.id, parsed.data.slug ?? en?.title ?? 'article');
    const status = parsed.data.status ?? JournalArticleStatus.DRAFT;
    const publishedAt =
      parsed.data.publishedAt ??
      (status === JournalArticleStatus.PUBLISHED ? new Date() : null);
    const productIds = [...new Set(parsed.data.recommendedProductIds ?? [])];
    await this.assertProductsInMarket(productIds, marketRow.id);

    const createdId = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.journalArticle.create({
          data: {
            slug,
            status,
            publishedAt,
            coverMediaId: parsed.data.coverMediaId ?? null,
            marketId: marketRow.id,
            translations: {
              create: parsed.data.translations.map((t) => ({
                locale: t.locale as Locale,
                title: t.title,
                excerpt: t.excerpt?.trim() ? t.excerpt : null,
                body: t.body,
              })),
            },
          },
        });
        await this.syncGallery(tx, created.id, parsed.data.galleryMediaIds);
        await this.syncProducts(tx, created.id, productIds);
        return created.id;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    // Load heavy includes outside the interactive transaction (avoids timed-out tx IDs).
    const row = await this.prisma.journalArticle.findUniqueOrThrow({
      where: { id: createdId },
      include: articleInclude,
    });
    return this.toDetail(row, SharedLocale.EN, true, currency);
  }

  async update(id: string, input: unknown) {
    const parsed = journalArticleUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.journalArticle.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Article not found');

    const currency = currencyForMarket(existing.market?.code ?? 'OTHER') as SharedCurrency;
    const en = parsed.data.translations.find((t) => t.locale === 'en');
    const desiredSlug =
      parsed.data.slug?.trim() ||
      (en ? slugify(en.title) : existing.slug) ||
      existing.slug;
    const slug = await this.uniqueSlug(existing.marketId, desiredSlug, id);
    const status = parsed.data.status ?? existing.status;
    let publishedAt =
      parsed.data.publishedAt !== undefined ? parsed.data.publishedAt : existing.publishedAt;
    if (
      status === JournalArticleStatus.PUBLISHED &&
      !publishedAt &&
      existing.status !== JournalArticleStatus.PUBLISHED
    ) {
      publishedAt = new Date();
    }

    if (parsed.data.recommendedProductIds !== undefined) {
      const productIds = [...new Set(parsed.data.recommendedProductIds)];
      await this.assertProductsInMarket(productIds, existing.marketId);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.journalArticle.update({
          where: { id },
          data: {
            slug,
            status,
            publishedAt,
            coverMediaId:
              parsed.data.coverMediaId !== undefined
                ? parsed.data.coverMediaId
                : existing.coverMediaId,
          },
        });

        for (const t of parsed.data.translations) {
          await tx.journalArticleTranslation.upsert({
            where: {
              articleId_locale: { articleId: id, locale: t.locale as Locale },
            },
            create: {
              articleId: id,
              locale: t.locale as Locale,
              title: t.title,
              excerpt: t.excerpt?.trim() ? t.excerpt : null,
              body: t.body,
            },
            update: {
              title: t.title,
              excerpt: t.excerpt?.trim() ? t.excerpt : null,
              body: t.body,
            },
          });
        }

        await this.syncGallery(tx, id, parsed.data.galleryMediaIds);
        await this.syncProducts(tx, id, parsed.data.recommendedProductIds);
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const row = await this.prisma.journalArticle.findUniqueOrThrow({
      where: { id },
      include: articleInclude,
    });
    return this.toDetail(row, SharedLocale.EN, true, currency);
  }

  async remove(id: string) {
    await this.prisma.journalArticle.delete({ where: { id } });
    return { success: true };
  }
}
