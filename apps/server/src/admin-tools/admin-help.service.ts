import { BadRequestException, Injectable } from '@nestjs/common';
import type { MarketCode } from '@lumea/types';
import { PrismaService } from '../prisma/prisma.service';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';

const FIELD_KEY = /^[a-z][a-z0-9_.-]{1,119}$/;

@Injectable()
export class AdminHelpService {
  constructor(private readonly prisma: PrismaService, private readonly markets: MarketsService) {}

  private async market(code: MarketCode | string) {
    return this.markets.getByCode(parseMarketCode(code));
  }

  async list(code: MarketCode | string) {
    const market = await this.market(code);
    const [settings, items] = await Promise.all([
      this.prisma.storeSettings.findUnique({ where: { marketId: market.id }, select: { adminHelpNotesEnabled: true } }),
      this.prisma.adminHelpNote.findMany({ where: { marketId: market.id }, orderBy: [{ fieldKey: 'asc' }] }),
    ]);
    return { enabled: settings?.adminHelpNotesEnabled ?? true, items };
  }

  async setEnabled(code: MarketCode | string, enabled: unknown) {
    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean');
    const market = await this.market(code);
    await this.prisma.storeSettings.upsert({
      where: { id: parseMarketCode(code) },
      create: { id: parseMarketCode(code), marketId: market.id, adminHelpNotesEnabled: enabled },
      update: { adminHelpNotesEnabled: enabled },
    });
    return { enabled };
  }

  async save(code: MarketCode | string, fieldKey: string, input: unknown) {
    if (!FIELD_KEY.test(fieldKey)) throw new BadRequestException('Choose a valid field key');
    const body = input as Record<string, unknown>;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const contentEn = typeof body?.contentEn === 'string' ? body.contentEn.trim() : '';
    const contentAr = typeof body?.contentAr === 'string' ? body.contentAr.trim() : '';
    const contentFr = typeof body?.contentFr === 'string' ? body.contentFr.trim() : '';
    const isActive = body?.isActive !== false;
    if (!title || !contentEn || title.length > 120 || contentEn.length > 4000 || contentAr.length > 4000 || contentFr.length > 4000) {
      throw new BadRequestException('Provide a title and English explanation (up to 4,000 characters)');
    }
    const market = await this.market(code);
    return this.prisma.adminHelpNote.upsert({
      where: { marketId_fieldKey: { marketId: market.id, fieldKey } },
      create: { marketId: market.id, fieldKey, title, contentEn, contentAr: contentAr || null, contentFr: contentFr || null, isActive },
      update: { title, contentEn, contentAr: contentAr || null, contentFr: contentFr || null, isActive },
    });
  }

  async remove(code: MarketCode | string, fieldKey: string) {
    const market = await this.market(code);
    await this.prisma.adminHelpNote.updateMany({ where: { marketId: market.id, fieldKey }, data: { isActive: false } });
    return { success: true };
  }
}
