import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Locale, MarketCode as PrismaMarketCode, Prisma } from '@prisma/client';
import { MarketCode } from '@lumea/types';
import { CatalogCacheService } from '../common/cache/catalog-cache.service';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';

export type TaxonomyKind = 'departments' | 'productTypes' | 'concerns' | 'ingredients';
type TranslationInput = { locale: Locale; name: string; description?: string | null };
type Payload = { name?: string; slug?: string; description?: string | null; sortOrder?: number; isActive?: boolean; departmentId?: string | null; translations?: TranslationInput[] };
type RecordDelegate = {
  findMany(args: any): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: { id: string }; include?: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

const relationNames: Record<TaxonomyKind, string> = {
  departments: 'department', productTypes: 'productType', concerns: 'skinConcern', ingredients: 'ingredient',
};
@Injectable()
export class TaxonomyAdminService {
  constructor(private readonly prisma: PrismaService, private readonly markets: MarketsService, private readonly cache: CatalogCacheService) {}

  private kind(value: string): TaxonomyKind {
    if (value === 'departments' || value === 'productTypes' || value === 'concerns' || value === 'ingredients') return value;
    throw new BadRequestException('Unknown taxonomy type');
  }

  private delegate(kind: TaxonomyKind): RecordDelegate {
    return (this.prisma as unknown as Record<string, unknown>)[relationNames[kind]] as RecordDelegate;
  }

  private validate(input: unknown, allowPartial = false): Payload {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid taxonomy data');
    const value = input as Payload;
    if (!allowPartial && (!value.translations?.some((item) => item.locale === Locale.en && item.name.trim()))) {
      throw new BadRequestException('English translation is required');
    }
    if (value.sortOrder !== undefined && !Number.isInteger(value.sortOrder)) throw new BadRequestException('Sort order must be an integer');
    if (value.translations?.some((item) => !Object.values(Locale).includes(item.locale) || !item.name.trim())) throw new BadRequestException('Translations need a supported locale and non-empty name');
    return value;
  }

  async list(kindInput: string, marketInput: MarketCode | string) {
    const kind = this.kind(kindInput);
    const market = await this.markets.getByCode(parseMarketCode(marketInput));
    const rows = await this.delegate(kind).findMany({ where: { marketId: market.id }, include: { translations: true, _count: { select: { products: true } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows;
  }

  async create(kindInput: string, marketInput: MarketCode | string, input: unknown) {
    const kind = this.kind(kindInput);
    const payload = this.validate(input);
    const code = parseMarketCode(marketInput);
    const market = await this.markets.getByCode(code);
    const translations = payload.translations!;
    const english = translations.find((item) => item.locale === Locale.en)!;
    const name = payload.name?.trim() || english.name.trim();
    const data: Record<string, unknown> = {
      name, slug: payload.slug?.trim() || slugify(name), description: payload.description ?? null,
      sortOrder: payload.sortOrder ?? 0, isActive: payload.isActive ?? true, marketId: market.id,
      translations: { create: translations.map((item) => ({ locale: item.locale, name: item.name.trim(), description: item.description ?? null })) },
    };
    if (kind === 'productTypes' && payload.departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: payload.departmentId, marketId: market.id } });
      if (!department) throw new BadRequestException('Choose a department from this market');
      data.department = { connect: { id: department.id } };
    }
    try {
      const row = await this.delegate(kind).create({ data, include: { translations: true } });
      await this.cache.invalidateCatalog(code);
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('That slug already exists in this market');
      throw error;
    }
  }

  async update(kindInput: string, id: string, input: unknown) {
    const kind = this.kind(kindInput);
    const payload = this.validate(input, true);
    const delegate = this.delegate(kind);
    const current = await delegate.findUnique({ where: { id }, include: { market: true, translations: true } });
    if (!current) throw new NotFoundException('Taxonomy item not found');
    const market = current.market as { code: PrismaMarketCode };
    const existingTranslations = (current.translations as TranslationInput[]) ?? [];
    const translations = payload.translations ?? [];
    const mainName = payload.name?.trim() || translations.find((item) => item.locale === Locale.en)?.name.trim() || existingTranslations.find((item) => item.locale === Locale.en)?.name;
    const data: Record<string, unknown> = {
      ...(mainName ? { name: mainName } : {}), ...(payload.slug !== undefined ? { slug: payload.slug.trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}), ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    };
    if (kind === 'productTypes' && payload.departmentId !== undefined) {
      if (payload.departmentId === null) data.department = { disconnect: true };
      else {
        const department = await this.prisma.department.findFirst({ where: { id: payload.departmentId, market: { code: market.code } } });
        if (!department) throw new BadRequestException('Choose a department from this market');
        data.department = { connect: { id: department.id } };
      }
    }
    if (translations.length) data.translations = { upsert: translations.map((item) => ({ where: { [`${kind === 'departments' ? 'department' : kind === 'productTypes' ? 'productType' : kind === 'concerns' ? 'skinConcern' : 'ingredient'}Id_locale`]: { [`${kind === 'departments' ? 'department' : kind === 'productTypes' ? 'productType' : kind === 'concerns' ? 'skinConcern' : 'ingredient'}Id`]: id, locale: item.locale } }, create: { locale: item.locale, name: item.name.trim(), description: item.description ?? null }, update: { name: item.name.trim(), description: item.description ?? null } })) };
    const row = await delegate.update({ where: { id }, data, include: { translations: true } });
    await this.cache.invalidateCatalog(market.code);
    return row;
  }

  async remove(kindInput: string, id: string) {
    const kind = this.kind(kindInput);
    const delegate = this.delegate(kind);
    const current = await delegate.findUnique({ where: { id }, include: { market: true, _count: { select: { products: true } } } });
    if (!current) throw new NotFoundException('Taxonomy item not found');
    const count = (current._count as { products: number } | undefined)?.products ?? 0;
    if (count) throw new BadRequestException('Remove product assignments before deleting this item');
    const market = current.market as { code: PrismaMarketCode };
    await delegate.delete({ where: { id } });
    await this.cache.invalidateCatalog(market.code);
    return { success: true };
  }
}
