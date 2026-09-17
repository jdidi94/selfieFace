-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceUsd" INTEGER NOT NULL DEFAULT 0,
    "priceTnd" INTEGER NOT NULL DEFAULT 0,
    "priceAed" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "eligibleForFreeShipping" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingMethod_code_key" ON "ShippingMethod"("code");

-- CreateIndex
CREATE INDEX "ShippingMethod_isActive_sortOrder_idx" ON "ShippingMethod"("isActive", "sortOrder");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippingMethodId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingMethodCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingMethodName" TEXT;

-- Seed three default methods (idempotent-ish via unique code on re-run would fail; run once)
INSERT INTO "ShippingMethod" ("id", "code", "name", "description", "priceUsd", "priceTnd", "priceAed", "sortOrder", "isActive", "eligibleForFreeShipping", "estimatedDaysMin", "estimatedDaysMax", "createdAt", "updatedAt")
VALUES
  ('ship_standard', 'STANDARD', 'Standard', 'Economy delivery', 500, 1500, 2000, 1, true, true, 3, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ship_express', 'EXPRESS', 'Express', 'Faster delivery', 1200, 3500, 4500, 2, true, false, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ship_priority', 'PRIORITY', 'Priority', 'Next-day style delivery', 2000, 6000, 7500, 3, true, false, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
