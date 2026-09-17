import { ProductKind, type Prisma } from '@prisma/client';
import {
  allocateAndDeduct,
  setVariantStockOnDefaultWarehouse,
  syncVariantAggregateStock,
  type AllocationPlan,
} from '../inventory/warehouse-stock.util';

/** Units of a pack (or plain variant) that can be sold from current component/variant stock. */
export function computePackAvailable(
  components: { quantity: number; variant: { stock: number } }[],
): number {
  if (!components.length) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const c of components) {
    const per = Math.max(1, c.quantity);
    min = Math.min(min, Math.floor(c.variant.stock / per));
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

export async function getSellableStock(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  variantId: string,
): Promise<number> {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: {
          kind: true,
          packComponents: {
            include: { variant: { select: { id: true, stock: true } } },
          },
        },
      },
    },
  });
  if (!variant) return 0;
  if (variant.product.kind === ProductKind.PACK && variant.product.packComponents.length) {
    return computePackAvailable(variant.product.packComponents);
  }
  return variant.stock;
}

export type PackStockEvent = {
  sku: string;
  variantName: string;
  productName: string;
  previousStock: number;
  nextStock: number;
  allocations: AllocationPlan[];
};

/**
 * Deduct stock for a sold line across warehouses (default first, then others).
 * Packs deduct component variants; standard products deduct the variant.
 * When `orderItemId` is set, records OrderItemAllocation for standard products.
 */
export async function deductSellableStock(
  tx: Prisma.TransactionClient,
  opts: {
    variantId: string;
    quantity: number;
    note: string;
    orderItemId?: string;
  },
): Promise<PackStockEvent[]> {
  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: opts.variantId },
    include: {
      product: {
        select: {
          name: true,
          kind: true,
          packComponents: {
            include: { variant: { select: { id: true, stock: true, sku: true, name: true } } },
          },
        },
      },
    },
  });

  const events: PackStockEvent[] = [];

  if (variant.product.kind === ProductKind.PACK && variant.product.packComponents.length) {
    const available = computePackAvailable(variant.product.packComponents);
    if (available < opts.quantity) {
      throw new Error(`Insufficient pack stock for ${variant.sku}`);
    }
    for (const c of variant.product.packComponents) {
      const delta = c.quantity * opts.quantity;
      const previousStock = c.variant.stock;
      if (previousStock < delta) {
        throw new Error(`Insufficient stock for ${c.variant.sku}`);
      }
      const allocations = await allocateAndDeduct(tx, {
        variantId: c.variant.id,
        quantity: delta,
        note: opts.note,
        // Pack lines allocate component stock without OrderItemAllocation (different SKU).
      });
      const nextStock = previousStock - delta;
      events.push({
        sku: c.variant.sku,
        variantName: c.variant.name,
        productName: variant.product.name,
        previousStock,
        nextStock,
        allocations,
      });
    }
    await setVariantStockOnDefaultWarehouse(tx, variant.id, available - opts.quantity, {
      force: true,
    });
    return events;
  }

  if (variant.stock < opts.quantity) {
    throw new Error(`Insufficient stock for ${variant.sku}`);
  }
  const previousStock = variant.stock;
  const allocations = await allocateAndDeduct(tx, {
    variantId: variant.id,
    quantity: opts.quantity,
    note: opts.note,
    orderItemId: opts.orderItemId,
  });
  const nextStock = previousStock - opts.quantity;
  // allocateAndDeduct already synced aggregate; keep event numbers consistent.
  await syncVariantAggregateStock(tx, variant.id);
  events.push({
    sku: variant.sku,
    variantName: variant.name,
    productName: variant.product.name,
    previousStock,
    nextStock,
    allocations,
  });
  return events;
}
