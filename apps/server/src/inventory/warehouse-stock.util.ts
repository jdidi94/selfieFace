import { InventoryReason, type Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

export type WarehousePick = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  quantity: number;
};

export type AllocationPlan = {
  warehouseId: string;
  quantity: number;
};

export type StockChangeEvent = {
  sku: string;
  variantName: string;
  productName: string;
  previousStock: number;
  nextStock: number;
  allocations: AllocationPlan[];
};

async function marketIdForVariant(db: Db, variantId: string): Promise<string> {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { product: { select: { marketId: true } } },
  });
  return variant.product.marketId;
}

/** Active warehouses for a market, ordered for checkout: default first, then name. */
export async function listActiveWarehousesForAllocation(db: Db, marketId: string) {
  return db.warehouse.findMany({
    where: { marketId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

export async function getDefaultWarehouse(db: Db, marketId: string) {
  const def = await db.warehouse.findFirst({
    where: { marketId, isDefault: true, isActive: true },
  });
  if (def) return def;
  const any = await db.warehouse.findFirst({
    where: { marketId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!any) throw new Error('No active warehouse configured for this market');
  return any;
}

/** Sum of stock in active warehouses (same market as the product) for a variant. */
export async function sumActiveWarehouseStock(db: Db, variantId: string): Promise<number> {
  const marketId = await marketIdForVariant(db, variantId);
  const rows = await db.warehouseStock.findMany({
    where: { variantId, warehouse: { isActive: true, marketId } },
    select: { quantity: true },
  });
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

export async function syncVariantAggregateStock(db: Db, variantId: string): Promise<number> {
  const total = await sumActiveWarehouseStock(db, variantId);
  await db.productVariant.update({
    where: { id: variantId },
    data: { stock: total },
  });
  return total;
}

export async function ensureWarehouseStockRow(
  db: Db,
  warehouseId: string,
  variantId: string,
  quantity = 0,
) {
  return db.warehouseStock.upsert({
    where: {
      warehouseId_variantId: { warehouseId, variantId },
    },
    create: { warehouseId, variantId, quantity },
    update: {},
  });
}

/**
 * Place initial / product-form stock on the market’s default warehouse and
 * zero-diff others so aggregate matches `targetStock`.
 * When `force` is true, other warehouses are zeroed so the default holds the full amount
 * (used for pack mirrored stock).
 */
export async function setVariantStockOnDefaultWarehouse(
  db: Db,
  variantId: string,
  targetStock: number,
  opts?: { force?: boolean },
) {
  if (targetStock < 0) throw new Error('Stock cannot be negative');
  const marketId = await marketIdForVariant(db, variantId);
  const warehouse = await getDefaultWarehouse(db, marketId);

  if (opts?.force) {
    await db.warehouseStock.updateMany({
      where: { variantId, warehouseId: { not: warehouse.id } },
      data: { quantity: 0 },
    });
  }

  const others = await db.warehouseStock.findMany({
    where: {
      variantId,
      warehouseId: { not: warehouse.id },
      warehouse: { isActive: true, marketId },
    },
    select: { quantity: true },
  });
  const otherSum = others.reduce((s, r) => s + r.quantity, 0);
  const defaultQty = targetStock - otherSum;
  if (defaultQty < 0) {
    throw new Error(
      `Cannot set stock to ${targetStock}: ${otherSum} units already sit in other warehouses`,
    );
  }
  await db.warehouseStock.upsert({
    where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId } },
    create: { warehouseId: warehouse.id, variantId, quantity: defaultQty },
    update: { quantity: defaultQty },
  });
  await syncVariantAggregateStock(db, variantId);
  return warehouse.id;
}

/** Plan how to take `quantity` from warehouses (default first). */
export function planAllocation(
  stocks: WarehousePick[],
  quantity: number,
): AllocationPlan[] {
  let remaining = quantity;
  const plan: AllocationPlan[] = [];
  for (const wh of stocks) {
    if (remaining <= 0) break;
    const take = Math.min(wh.quantity, remaining);
    if (take <= 0) continue;
    plan.push({ warehouseId: wh.id, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error('Insufficient warehouse stock');
  }
  return plan;
}

export async function loadVariantWarehouseStocks(
  db: Db,
  variantId: string,
): Promise<WarehousePick[]> {
  const marketId = await marketIdForVariant(db, variantId);
  const warehouses = await listActiveWarehousesForAllocation(db, marketId);
  const stocks = await db.warehouseStock.findMany({
    where: {
      variantId,
      warehouseId: { in: warehouses.map((w) => w.id) },
    },
  });
  const byWh = new Map(stocks.map((s) => [s.warehouseId, s.quantity]));
  return warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    isDefault: w.isDefault,
    quantity: byWh.get(w.id) ?? 0,
  }));
}

/**
 * Apply a signed delta to one warehouse and sync ProductVariant.stock.
 */
export async function adjustWarehouseStock(
  db: Db,
  opts: {
    variantId: string;
    warehouseId: string;
    quantityDelta: number;
    reason: InventoryReason;
    note?: string | null;
  },
): Promise<{ previousAggregate: number; nextAggregate: number }> {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: opts.variantId },
    include: { product: { select: { marketId: true } } },
  });
  const warehouse = await db.warehouse.findUniqueOrThrow({
    where: { id: opts.warehouseId },
  });
  if (warehouse.marketId !== variant.product.marketId) {
    throw new Error('Warehouse is not in the same market as this product');
  }

  const previousAggregate = variant.stock;

  const row = await ensureWarehouseStockRow(db, opts.warehouseId, opts.variantId);
  const nextQty = row.quantity + opts.quantityDelta;
  if (nextQty < 0) {
    throw new Error('Stock cannot be negative');
  }

  await db.warehouseStock.update({
    where: { id: row.id },
    data: { quantity: nextQty },
  });
  await db.inventoryMovement.create({
    data: {
      variantId: opts.variantId,
      warehouseId: opts.warehouseId,
      quantityDelta: opts.quantityDelta,
      reason: opts.reason,
      note: opts.note ?? null,
    },
  });

  const nextAggregate = await syncVariantAggregateStock(db, opts.variantId);
  return { previousAggregate, nextAggregate };
}

/**
 * Deduct `quantity` from warehouses (default first). Optionally record OrderItemAllocation.
 */
export async function allocateAndDeduct(
  db: Db,
  opts: {
    variantId: string;
    quantity: number;
    note: string;
    orderItemId?: string;
    reason?: InventoryReason;
  },
): Promise<AllocationPlan[]> {
  const stocks = await loadVariantWarehouseStocks(db, opts.variantId);
  const available = stocks.reduce((s, w) => s + w.quantity, 0);
  if (available < opts.quantity) {
    throw new Error('Insufficient warehouse stock');
  }
  const plan = planAllocation(stocks, opts.quantity);
  const reason = opts.reason ?? InventoryReason.SALE;

  for (const step of plan) {
    await adjustWarehouseStock(db, {
      variantId: opts.variantId,
      warehouseId: step.warehouseId,
      quantityDelta: -step.quantity,
      reason,
      note: opts.note,
    });
    if (opts.orderItemId) {
      await db.orderItemAllocation.create({
        data: {
          orderItemId: opts.orderItemId,
          warehouseId: step.warehouseId,
          quantity: step.quantity,
        },
      });
    }
  }
  return plan;
}

/**
 * Restock using prior allocations when present; otherwise default warehouse.
 */
export async function restockFromAllocations(
  db: Db,
  opts: {
    variantId: string;
    quantity: number;
    note: string;
    allocations: { warehouseId: string; quantity: number }[];
  },
): Promise<{ previousAggregate: number; nextAggregate: number }> {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: opts.variantId },
    include: { product: { select: { marketId: true } } },
  });
  const previousAggregate = variant.stock;

  if (opts.allocations.length) {
    for (const a of opts.allocations) {
      await adjustWarehouseStock(db, {
        variantId: opts.variantId,
        warehouseId: a.warehouseId,
        quantityDelta: a.quantity,
        reason: InventoryReason.RESTOCK,
        note: opts.note,
      });
    }
  } else {
    const warehouse = await getDefaultWarehouse(db, variant.product.marketId);
    await adjustWarehouseStock(db, {
      variantId: opts.variantId,
      warehouseId: warehouse.id,
      quantityDelta: opts.quantity,
      reason: InventoryReason.RESTOCK,
      note: opts.note,
    });
  }

  const nextAggregate = await sumActiveWarehouseStock(db, opts.variantId);
  return { previousAggregate, nextAggregate };
}
