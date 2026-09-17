import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryReason } from '@prisma/client';
import type { InventoryListResponse, MarketCode, WarehouseDto } from '@lumea/types';
import { inventoryAdjustSchema, inventoryTransferSchema } from '@lumea/validation';
import { CatalogCacheService } from '../common/cache/catalog-cache.service';
import { StockNotifyService } from '../commerce/stock-notify.service';
import { StoreSettingsService } from '../commerce/store-settings.service';
import { SesMailService } from '../mail/ses-mail.service';
import { MarketsService } from '../markets/markets.service';
import { parseMarketCode } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { crossedLowStockThreshold } from './low-stock.util';
import {
  adjustWarehouseStock,
  getDefaultWarehouse,
  syncVariantAggregateStock,
} from './warehouse-stock.util';
import { WarehousesService } from './warehouses.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
    private readonly stockNotify: StockNotifyService,
    private readonly settingsService: StoreSettingsService,
    private readonly mail: SesMailService,
    private readonly warehousesService: WarehousesService,
    private readonly marketsService: MarketsService,
  ) {}

  async list(marketCode: MarketCode | string = 'OTHER'): Promise<InventoryListResponse> {
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    const [variants, settings, warehouses] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { product: { marketId: market.id } },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          warehouseStocks: {
            where: { warehouse: { marketId: market.id } },
            include: {
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  isDefault: true,
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: { stock: 'asc' },
      }),
      this.settingsService.get(code),
      this.warehousesService.list(code),
    ]);

    return {
      lowStockThreshold: settings.lowStockThreshold,
      warehouses,
      items: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        stock: v.stock,
        isActive: v.isActive,
        product: v.product,
        warehouses: v.warehouseStocks.map((ws) => ({
          warehouseId: ws.warehouse.id,
          warehouseCode: ws.warehouse.code,
          warehouseName: ws.warehouse.name,
          isDefault: ws.warehouse.isDefault,
          isActive: ws.warehouse.isActive,
          quantity: ws.quantity,
        })),
      })),
    };
  }

  async adjust(variantId: string, input: unknown) {
    const parsed = inventoryAdjustSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { name: true, marketId: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const warehouseId =
      parsed.data.warehouseId ??
      (await getDefaultWarehouse(this.prisma, variant.product.marketId)).id;
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }
    if (warehouse.marketId !== variant.product.marketId) {
      throw new BadRequestException('Warehouse is not in the same market as this product');
    }

    const previousStock = variant.stock;
    let nextStock: number;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        return adjustWarehouseStock(tx, {
          variantId,
          warehouseId,
          quantityDelta: parsed.data.quantityDelta,
          reason: parsed.data.reason as InventoryReason,
          note: parsed.data.note,
        });
      });
      nextStock = result.nextAggregate;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Stock adjustment failed',
      );
    }

    const updated = await this.prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    await this.catalogCache.invalidateCatalog();
    await this.stockNotify.onStockAvailable(variantId, previousStock, nextStock);
    await this.maybeNotifyLowStock({
      previousStock,
      nextStock,
      sku: variant.sku,
      variantName: variant.name,
      productName: variant.product.name,
      marketId: variant.product.marketId,
    });
    return updated;
  }

  async transfer(input: unknown) {
    const parsed = inventoryTransferSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const data = parsed.data;

    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must differ');
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: data.variantId },
      include: { product: { select: { marketId: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: data.fromWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: data.toWarehouseId } }),
    ]);
    if (!fromWh?.isActive || !toWh?.isActive) {
      throw new BadRequestException('Both warehouses must exist and be active');
    }
    if (
      fromWh.marketId !== variant.product.marketId ||
      toWh.marketId !== variant.product.marketId
    ) {
      throw new BadRequestException('Transfers must stay within the product’s market');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await adjustWarehouseStock(tx, {
          variantId: data.variantId,
          warehouseId: data.fromWarehouseId,
          quantityDelta: -data.quantity,
          reason: InventoryReason.TRANSFER,
          note: data.note ?? `Transfer to ${toWh.code}`,
        });
        await adjustWarehouseStock(tx, {
          variantId: data.variantId,
          warehouseId: data.toWarehouseId,
          quantityDelta: data.quantity,
          reason: InventoryReason.TRANSFER,
          note: data.note ?? `Transfer from ${fromWh.code}`,
        });
        await syncVariantAggregateStock(tx, data.variantId);
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Transfer failed',
      );
    }

    await this.catalogCache.invalidateCatalog();
    return this.prisma.productVariant.findUniqueOrThrow({
      where: { id: data.variantId },
      include: {
        warehouseStocks: { include: { warehouse: true } },
      },
    });
  }

  async maybeNotifyLowStock(opts: {
    previousStock: number;
    nextStock: number;
    sku: string;
    variantName: string;
    productName: string;
    threshold?: number;
    marketId?: string;
  }) {
    let threshold = opts.threshold;
    if (threshold == null) {
      if (opts.marketId) {
        const market = await this.prisma.market.findUnique({ where: { id: opts.marketId } });
        threshold = market
          ? (await this.settingsService.get(parseMarketCode(market.code))).lowStockThreshold
          : (await this.settingsService.get()).lowStockThreshold;
      } else {
        threshold = (await this.settingsService.get()).lowStockThreshold;
      }
    }
    if (!crossedLowStockThreshold(opts.previousStock, opts.nextStock, threshold)) {
      return;
    }
    await this.mail.notifyAdminLowStock({
      productName: opts.productName,
      variantName: opts.variantName,
      sku: opts.sku,
      stock: opts.nextStock,
      threshold,
    });
  }

  /** Expose warehouses for inventory list without circular typing issues. */
  listWarehouses(marketCode: MarketCode | string = 'OTHER'): Promise<WarehouseDto[]> {
    return this.warehousesService.list(marketCode);
  }
}
