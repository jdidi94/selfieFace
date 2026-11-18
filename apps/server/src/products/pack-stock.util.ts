import { InventoryReason, ProductKind, type Prisma } from '@prisma/client';
import {
  allocateAndDeduct,
  lockVariantStock,
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

/** Refresh denormalized pack-variant stock after component stock is returned. */
export async function syncPackStockForComponents(
  tx: Prisma.TransactionClient,
  componentVariantIds: string[],
): Promise<void> {
  if (!componentVariantIds.length) return;
  const packs = await tx.product.findMany({
    where: { kind: ProductKind.PACK, packComponents: { some: { variantId: { in: componentVariantIds } } } },
    select: {
      variants: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      packComponents: { select: { quantity: true, variant: { select: { stock: true } } } },
    },
  });
  for (const pack of packs) {
    const variantId = pack.variants[0]?.id;
    if (!variantId) continue;
    await setVariantStockOnDefaultWarehouse(tx, variantId, computePackAvailable(pack.packComponents), { force: true });
  }
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
    reason?: InventoryReason;
  },
): Promise<PackStockEvent[]> {
  let variant = await tx.productVariant.findUniqueOrThrow({
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

  if (variant.product.kind === ProductKind.PACK && variant.product.packComponents.length) {
    for (const componentVariantId of variant.product.packComponents.map((component) => component.variant.id).sort()) {
      await lockVariantStock(tx, componentVariantId);
    }
    variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: opts.variantId },
      include: {
        product: {
          select: {
            name: true,
            kind: true,
            packComponents: {
              orderBy: { variantId: 'asc' },
              include: { variant: { select: { id: true, stock: true, sku: true, name: true } } },
            },
          },
        },
      },
    });
  } else {
    await lockVariantStock(tx, opts.variantId);
    variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: opts.variantId },
      include: {
        product: {
          select: {
            name: true,
            kind: true,
            packComponents: {
              orderBy: { variantId: 'asc' },
              include: { variant: { select: { id: true, stock: true, sku: true, name: true } } },
            },
          },
        },
      },
    });
  }

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
        orderItemId: opts.orderItemId,
        reason: opts.reason,
      });
      const nextStock = (await tx.productVariant.findUniqueOrThrow({ where: { id: c.variant.id }, select: { stock: true } })).stock;
      events.push({
        sku: c.variant.sku,
        variantName: c.variant.name,
        productName: variant.product.name,
        previousStock,
        nextStock,
        allocations,
      });
    }
    const remainingComponents = await tx.packComponent.findMany({
      where: { packProductId: variant.productId },
      select: { quantity: true, variant: { select: { stock: true } } },
    });
    await setVariantStockOnDefaultWarehouse(tx, variant.id, computePackAvailable(remainingComponents), {
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
    reason: opts.reason,
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
