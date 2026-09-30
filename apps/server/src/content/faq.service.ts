import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Prisma } from '@prisma/client';
import {
  Locale as SharedLocale,
  type AdminFaqListResponse,
  type FaqItemDto,
  type FaqListResponse,
  type MarketCode,
} from '@lumea/types';
import {
  faqItemUpsertSchema,
  faqListQuerySchema,
  localeSchema,
} from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import {
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { mapFaqItem } from './content.mapper';

const faqInclude = {
  translations: true,
  market: true,
} satisfies Prisma.FaqItemInclude;

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  private parseLocale(locale?: string): SharedLocale {
    return localeSchema.safeParse(locale).success
      ? (locale as SharedLocale)
      : SharedLocale.EN;
  }

  async listPublic(query: unknown): Promise<FaqListResponse> {
    const parsed = faqListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { locale, currency, market } = parsed.data;
    const lang = this.parseLocale(locale);
    const marketCode = market
      ? parseMarketCode(market)
      : marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);

    const rows = await this.prisma.faqItem.findMany({
      where: { marketId: marketRow.id, published: true },
      include: faqInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      items: rows.map((row) => mapFaqItem(row, lang)),
      locale: lang,
    };
  }

  async listAdmin(marketCode: MarketCode | string = 'OTHER'): Promise<AdminFaqListResponse> {
    const marketRow = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.faqItem.findMany({
      where: { marketId: marketRow.id },
      include: faqInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return {
      items: rows.map((row) => mapFaqItem(row, SharedLocale.EN, true)),
    };
  }

  async getAdmin(id: string): Promise<FaqItemDto> {
    const row = await this.prisma.faqItem.findUnique({
      where: { id },
      include: faqInclude,
    });
    if (!row) throw new NotFoundException('FAQ item not found');
    return mapFaqItem(row, SharedLocale.EN, true);
  }

  async create(input: unknown, marketCode: MarketCode | string = 'OTHER'): Promise<FaqItemDto> {
    const parsed = faqItemUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(marketCode);
    const marketRow = await this.marketsService.getByCode(code);

    const row = await this.prisma.faqItem.create({
      data: {
        category: parsed.data.category?.trim() || null,
        sortOrder: parsed.data.sortOrder ?? 0,
        published: parsed.data.published ?? false,
        marketId: marketRow.id,
        translations: {
          create: parsed.data.translations.map((t) => ({
            locale: t.locale as Locale,
            question: t.question.trim(),
            answer: t.answer.trim(),
          })),
        },
      },
      include: faqInclude,
    });
    return mapFaqItem(row, SharedLocale.EN, true);
  }

  async update(id: string, input: unknown): Promise<FaqItemDto> {
    const parsed = faqItemUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.faqItemTranslation.deleteMany({ where: { faqItemId: id } });
      return tx.faqItem.update({
        where: { id },
        data: {
          category: parsed.data.category?.trim() || null,
          sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
          published: parsed.data.published ?? existing.published,
          translations: {
            create: parsed.data.translations.map((t) => ({
              locale: t.locale as Locale,
              question: t.question.trim(),
              answer: t.answer.trim(),
            })),
          },
        },
        include: faqInclude,
      });
    });

    return mapFaqItem(row, SharedLocale.EN, true);
  }

  async remove(id: string) {
    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');
    await this.prisma.faqItem.delete({ where: { id } });
    return { ok: true };
  }
}
