-- ShippingMethod.marketId — clone existing methods into AE / TN / OTHER
ALTER TABLE "ShippingMethod" ADD COLUMN "marketId" TEXT;

UPDATE "ShippingMethod" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

DROP INDEX IF EXISTS "ShippingMethod_code_key";
DROP INDEX IF EXISTS "ShippingMethod_isActive_sortOrder_idx";

INSERT INTO "ShippingMethod" (
  "id", "code", "name", "description",
  "priceUsd", "priceTnd", "priceAed",
  "sortOrder", "isActive", "eligibleForFreeShipping",
  "estimatedDaysMin", "estimatedDaysMax",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'sm_ae_' || "code", "code", "name", "description",
  "priceUsd", "priceTnd", "priceAed",
  "sortOrder", "isActive", "eligibleForFreeShipping",
  "estimatedDaysMin", "estimatedDaysMax",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_ae'
FROM "ShippingMethod"
WHERE "marketId" = 'market_other';

INSERT INTO "ShippingMethod" (
  "id", "code", "name", "description",
  "priceUsd", "priceTnd", "priceAed",
  "sortOrder", "isActive", "eligibleForFreeShipping",
  "estimatedDaysMin", "estimatedDaysMax",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'sm_tn_' || "code", "code", "name", "description",
  "priceUsd", "priceTnd", "priceAed",
  "sortOrder", "isActive", "eligibleForFreeShipping",
  "estimatedDaysMin", "estimatedDaysMax",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_tn'
FROM "ShippingMethod"
WHERE "marketId" = 'market_other';

ALTER TABLE "ShippingMethod" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "ShippingMethod_marketId_code_key" ON "ShippingMethod"("marketId", "code");
CREATE INDEX "ShippingMethod_marketId_isActive_sortOrder_idx" ON "ShippingMethod"("marketId", "isActive", "sortOrder");

ALTER TABLE "ShippingMethod"
  ADD CONSTRAINT "ShippingMethod_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Promotion.marketId — existing campaigns → OTHER
ALTER TABLE "Promotion" ADD COLUMN "marketId" TEXT;

UPDATE "Promotion" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "Promotion" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "Promotion_slug_key";

CREATE UNIQUE INDEX "Promotion_marketId_slug_key" ON "Promotion"("marketId", "slug");
CREATE INDEX "Promotion_marketId_idx" ON "Promotion"("marketId");

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MerchandisingRailItem.marketId — from product window
ALTER TABLE "MerchandisingRailItem" ADD COLUMN "marketId" TEXT;

UPDATE "MerchandisingRailItem" m
SET "marketId" = p."marketId"
FROM "Product" p
WHERE m."productId" = p."id" AND m."marketId" IS NULL;

-- Orphans (should not exist): attach to OTHER
UPDATE "MerchandisingRailItem" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "MerchandisingRailItem" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "MerchandisingRailItem_rail_productId_key";
DROP INDEX IF EXISTS "MerchandisingRailItem_rail_sortOrder_idx";

CREATE UNIQUE INDEX "MerchandisingRailItem_marketId_rail_productId_key"
  ON "MerchandisingRailItem"("marketId", "rail", "productId");
CREATE INDEX "MerchandisingRailItem_marketId_rail_sortOrder_idx"
  ON "MerchandisingRailItem"("marketId", "rail", "sortOrder");

ALTER TABLE "MerchandisingRailItem"
  ADD CONSTRAINT "MerchandisingRailItem_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order.marketId — backfill from currency (AED→AE, TND→TN, else OTHER)
ALTER TABLE "Order" ADD COLUMN "marketId" TEXT;

UPDATE "Order" SET "marketId" = 'market_ae' WHERE "currency" = 'AED' AND "marketId" IS NULL;
UPDATE "Order" SET "marketId" = 'market_tn' WHERE "currency" = 'TND' AND "marketId" IS NULL;
UPDATE "Order" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "marketId" SET NOT NULL;

CREATE INDEX "Order_marketId_createdAt_idx" ON "Order"("marketId", "createdAt");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
