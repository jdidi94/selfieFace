import { BadRequestException, Injectable } from '@nestjs/common';
import { Locale as PrismaLocale } from '@prisma/client';
import { Locale, MarketCode, type LegalDocumentDto } from '@lumea/types';
import {
  legalDocumentQuerySchema,
  legalDocumentUpsertSchema,
} from '@lumea/validation';
import { marketCodeFromCurrencyValue, parseMarketCode } from '../markets/market.util';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LegalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  async getPublic(query: unknown): Promise<LegalDocumentDto | null> {
    const parsed = legalDocumentQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const marketCode = marketCodeFromCurrencyValue(parsed.data.currency);
    const market = await this.marketsService.getByCode(marketCode);
    const exact = await this.prisma.legalDocument.findUnique({
      where: {
        marketId_slug_locale: {
          marketId: market.id,
          slug: parsed.data.slug,
          locale: parsed.data.locale as PrismaLocale,
        },
      },
    });
    if (exact) return this.toDto(exact);

    const fallbackMarket = await this.marketsService.getByCode(MarketCode.OTHER);
    const fallback = await this.prisma.legalDocument.findFirst({
      where: {
        marketId: fallbackMarket.id,
        slug: parsed.data.slug,
        locale: parsed.data.locale as PrismaLocale,
      },
    });
    if (fallback) return this.toDto(fallback);
    if (parsed.data.locale !== Locale.EN) {
      const englishFallback = await this.prisma.legalDocument.findFirst({
        where: {
          marketId: fallbackMarket.id,
          slug: parsed.data.slug,
          locale: PrismaLocale.en,
        },
      });
      if (englishFallback) return this.toDto(englishFallback);
    }
    return null;
  }

  async listAdmin(marketCode: MarketCode | string) {
    const market = await this.marketsService.getByCode(parseMarketCode(marketCode));
    const documents = await this.prisma.legalDocument.findMany({
      where: { marketId: market.id },
      orderBy: [{ slug: 'asc' }, { locale: 'asc' }],
    });
    return documents.map((document) => this.toDto(document));
  }

  async save(input: unknown, marketCode: MarketCode | string) {
    const parsed = legalDocumentUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const market = await this.marketsService.getByCode(parseMarketCode(marketCode));
    const document = await this.prisma.legalDocument.upsert({
      where: {
        marketId_slug_locale: {
          marketId: market.id,
          slug: parsed.data.slug,
          locale: parsed.data.locale as PrismaLocale,
        },
      },
      create: {
        marketId: market.id,
        slug: parsed.data.slug,
        locale: parsed.data.locale as PrismaLocale,
        title: parsed.data.title,
        content: parsed.data.content,
      },
      update: {
        title: parsed.data.title,
        content: parsed.data.content,
      },
    });
    return this.toDto(document);
  }

  private toDto(document: {
    id: string;
    slug: string;
    locale: string;
    title: string;
    content: string;
    updatedAt: Date;
  }): LegalDocumentDto {
    return {
      id: document.id,
      slug: document.slug as LegalDocumentDto['slug'],
      locale: document.locale as Locale,
      title: document.title,
      content: document.content,
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
