import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MarketCode, WarehouseDto } from '@lumea/types';
import { warehouseUpdateSchema, warehouseUpsertSchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { syncVariantAggregateStock } from './warehouse-stock.util';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  private map(w: {
    id: string;
    name: string;
    code: string;
    line1: string | null;
    line2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    isActive: boolean;
    isDefault: boolean;
    marketId: string;
    createdAt: Date;
    updatedAt: Date;
    market?: { code: string };
  }): WarehouseDto {
    return {
      id: w.id,
      name: w.name,
      code: w.code,
      line1: w.line1,
      line2: w.line2,
      city: w.city,
      region: w.region,
      postalCode: w.postalCode,
      country: w.country,
      isActive: w.isActive,
      isDefault: w.isDefault,
      marketId: w.marketId,
      marketCode: w.market ? parseMarketCode(w.market.code) : undefined,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  async list(marketCode: MarketCode | string = 'OTHER'): Promise<WarehouseDto[]> {
    const market = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.warehouse.findMany({
      where: { marketId: market.id },
      include: { market: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map((w) => this.map(w));
  }

  async create(
    input: unknown,
    marketCode: MarketCode | string = 'OTHER',
  ): Promise<WarehouseDto> {
    const parsed = warehouseUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = parsed.data;
    const market = await this.marketsService.getByCode(marketCode);

    const existingCode = await this.prisma.warehouse.findUnique({
      where: { marketId_code: { marketId: market.id, code: data.code } },
    });
    if (existingCode) throw new BadRequestException('Warehouse code already exists');

    const makeDefault = data.isDefault === true;
    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.warehouse.updateMany({
          where: { marketId: market.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      const count = await tx.warehouse.count({ where: { marketId: market.id } });
      return tx.warehouse.create({
        data: {
          name: data.name,
          code: data.code,
          line1: data.line1 ?? null,
          line2: data.line2 ?? null,
          city: data.city ?? null,
          region: data.region ?? null,
          postalCode: data.postalCode ?? null,
          country: data.country ?? null,
          isActive: data.isActive ?? true,
          isDefault: makeDefault || count === 0,
          marketId: market.id,
        },
        include: { market: true },
      });
    });
    return this.map(row);
  }

  async update(id: string, input: unknown): Promise<WarehouseDto> {
    const parsed = warehouseUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = parsed.data;

    const existing = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new NotFoundException('Warehouse not found');

    if (data.code && data.code !== existing.code) {
      const clash = await this.prisma.warehouse.findUnique({
        where: { marketId_code: { marketId: existing.marketId, code: data.code } },
      });
      if (clash) throw new BadRequestException('Warehouse code already exists');
    }

    if (data.isActive === false && existing.isDefault) {
      throw new BadRequestException('Cannot deactivate the default warehouse; set another default first');
    }
    if (data.isDefault === false && existing.isDefault) {
      throw new BadRequestException('Cannot unset default; mark another warehouse as default instead');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.warehouse.updateMany({
          where: { marketId: existing.marketId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const updated = await tx.warehouse.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.line1 !== undefined ? { line1: data.line1 } : {}),
          ...(data.line2 !== undefined ? { line2: data.line2 } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.region !== undefined ? { region: data.region } : {}),
          ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
          ...(data.country !== undefined ? { country: data.country } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
        include: { market: true },
      });

      if (data.isActive !== undefined && data.isActive !== existing.isActive) {
        const stocks = await tx.warehouseStock.findMany({
          where: { warehouseId: id },
          select: { variantId: true },
        });
        for (const s of stocks) {
          await syncVariantAggregateStock(tx, s.variantId);
        }
      }

      return updated;
    });

    return this.map(row);
  }
}
