-- Multi-warehouse inventory
-- ProductVariant.stock remains the denormalized sum across active warehouses.

CREATE TYPE "InventoryReason_new" AS ENUM ('SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN', 'TRANSFER');
ALTER TABLE "InventoryMovement" ALTER COLUMN "reason" TYPE "InventoryReason_new" USING ("reason"::text::"InventoryReason_new");
DROP TYPE "InventoryReason";
ALTER TYPE "InventoryReason_new" RENAME TO "InventoryReason";

CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");
CREATE INDEX "Warehouse_isDefault_idx" ON "Warehouse"("isDefault");

CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseStock_warehouseId_variantId_key" ON "WarehouseStock"("warehouseId", "variantId");
CREATE INDEX "WarehouseStock_variantId_idx" ON "WarehouseStock"("variantId");
CREATE INDEX "WarehouseStock_warehouseId_idx" ON "WarehouseStock"("warehouseId");

ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement" ADD COLUMN "warehouseId" TEXT;
CREATE INDEX "InventoryMovement_warehouseId_idx" ON "InventoryMovement"("warehouseId");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OrderItemAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItemAllocation_orderItemId_idx" ON "OrderItemAllocation"("orderItemId");
CREATE INDEX "OrderItemAllocation_warehouseId_idx" ON "OrderItemAllocation"("warehouseId");

ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default warehouse and migrate existing ProductVariant.stock rows.
INSERT INTO "Warehouse" ("id", "name", "code", "line1", "city", "country", "isActive", "isDefault", "createdAt", "updatedAt")
VALUES (
  'wh_main_default',
  'Main warehouse',
  'main',
  NULL,
  NULL,
  NULL,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "WarehouseStock" ("id", "warehouseId", "variantId", "quantity", "createdAt", "updatedAt")
SELECT
  'ws_' || v."id",
  'wh_main_default',
  v."id",
  v."stock",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductVariant" v;
