-- StoreSettings: collapse multi-currency columns → single values per market window
ALTER TABLE "StoreSettings" ADD COLUMN "freeShippingEnabled" BOOLEAN;
ALTER TABLE "StoreSettings" ADD COLUMN "freeShippingThreshold" INTEGER;
ALTER TABLE "StoreSettings" ADD COLUMN "domesticShipping" INTEGER;
ALTER TABLE "StoreSettings" ADD COLUMN "internationalShipping" INTEGER;

UPDATE "StoreSettings" s
SET
  "freeShippingEnabled" = CASE m."code"
    WHEN 'AE' THEN s."freeShippingEnabledAed"
    WHEN 'TN' THEN s."freeShippingEnabledTnd"
    ELSE s."freeShippingEnabledUsd"
  END,
  "freeShippingThreshold" = CASE m."code"
    WHEN 'AE' THEN s."freeShippingThresholdAed"
    WHEN 'TN' THEN s."freeShippingThresholdTnd"
    ELSE s."freeShippingThresholdUsd"
  END,
  "domesticShipping" = CASE m."code"
    WHEN 'AE' THEN s."domesticShippingAed"
    WHEN 'TN' THEN s."domesticShippingTnd"
    ELSE s."domesticShippingUsd"
  END,
  "internationalShipping" = CASE m."code"
    WHEN 'AE' THEN s."internationalShippingAed"
    WHEN 'TN' THEN s."internationalShippingTnd"
    ELSE s."internationalShippingUsd"
  END
FROM "Market" m
WHERE s."marketId" = m."id";

UPDATE "StoreSettings" SET "freeShippingEnabled" = true WHERE "freeShippingEnabled" IS NULL;
UPDATE "StoreSettings" SET "freeShippingThreshold" = 10000 WHERE "freeShippingThreshold" IS NULL;
UPDATE "StoreSettings" SET "domesticShipping" = 500 WHERE "domesticShipping" IS NULL;
UPDATE "StoreSettings" SET "internationalShipping" = 1500 WHERE "internationalShipping" IS NULL;

ALTER TABLE "StoreSettings" ALTER COLUMN "freeShippingEnabled" SET NOT NULL;
ALTER TABLE "StoreSettings" ALTER COLUMN "freeShippingEnabled" SET DEFAULT true;
ALTER TABLE "StoreSettings" ALTER COLUMN "freeShippingThreshold" SET NOT NULL;
ALTER TABLE "StoreSettings" ALTER COLUMN "freeShippingThreshold" SET DEFAULT 10000;
ALTER TABLE "StoreSettings" ALTER COLUMN "domesticShipping" SET NOT NULL;
ALTER TABLE "StoreSettings" ALTER COLUMN "domesticShipping" SET DEFAULT 500;
ALTER TABLE "StoreSettings" ALTER COLUMN "internationalShipping" SET NOT NULL;
ALTER TABLE "StoreSettings" ALTER COLUMN "internationalShipping" SET DEFAULT 1500;

ALTER TABLE "StoreSettings"
  DROP COLUMN "freeShippingEnabledUsd",
  DROP COLUMN "freeShippingEnabledTnd",
  DROP COLUMN "freeShippingEnabledAed",
  DROP COLUMN "freeShippingThresholdUsd",
  DROP COLUMN "freeShippingThresholdTnd",
  DROP COLUMN "freeShippingThresholdAed",
  DROP COLUMN "domesticShippingUsd",
  DROP COLUMN "domesticShippingTnd",
  DROP COLUMN "domesticShippingAed",
  DROP COLUMN "internationalShippingUsd",
  DROP COLUMN "internationalShippingTnd",
  DROP COLUMN "internationalShippingAed";

-- ShippingMethod: single price in market currency
ALTER TABLE "ShippingMethod" ADD COLUMN "price" INTEGER;

UPDATE "ShippingMethod" sm
SET "price" = CASE m."code"
  WHEN 'AE' THEN sm."priceAed"
  WHEN 'TN' THEN sm."priceTnd"
  ELSE sm."priceUsd"
END
FROM "Market" m
WHERE sm."marketId" = m."id";

UPDATE "ShippingMethod" SET "price" = 0 WHERE "price" IS NULL;

ALTER TABLE "ShippingMethod" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "ShippingMethod" ALTER COLUMN "price" SET DEFAULT 0;

ALTER TABLE "ShippingMethod"
  DROP COLUMN "priceUsd",
  DROP COLUMN "priceTnd",
  DROP COLUMN "priceAed";

-- Category.marketId — clone existing categories into AE / TN / OTHER
ALTER TABLE "Category" ADD COLUMN "marketId" TEXT;

UPDATE "Category" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

DROP INDEX IF EXISTS "Category_slug_key";

INSERT INTO "Category" (
  "id", "name", "slug", "description", "sortOrder",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'cat_ae_' || "id", "name", "slug", "description", "sortOrder",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_ae'
FROM "Category"
WHERE "marketId" = 'market_other';

INSERT INTO "Category" (
  "id", "name", "slug", "description", "sortOrder",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'cat_tn_' || "id", "name", "slug", "description", "sortOrder",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_tn'
FROM "Category"
WHERE "marketId" = 'market_other';

INSERT INTO "CategoryTranslation" (
  "id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt"
)
SELECT
  'ct_ae_' || t."id", 'cat_ae_' || t."categoryId", t."locale", t."name", t."description",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CategoryTranslation" t
INNER JOIN "Category" c ON c."id" = t."categoryId"
WHERE c."marketId" = 'market_other';

INSERT INTO "CategoryTranslation" (
  "id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt"
)
SELECT
  'ct_tn_' || t."id", 'cat_tn_' || t."categoryId", t."locale", t."name", t."description",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CategoryTranslation" t
INNER JOIN "Category" c ON c."id" = t."categoryId"
WHERE c."marketId" = 'market_other';

UPDATE "Product" p
SET "categoryId" = 'cat_ae_' || p."categoryId"
WHERE p."marketId" = 'market_ae'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."id" = 'cat_ae_' || p."categoryId");

UPDATE "Product" p
SET "categoryId" = 'cat_tn_' || p."categoryId"
WHERE p."marketId" = 'market_tn'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."id" = 'cat_tn_' || p."categoryId");

ALTER TABLE "Category" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "Category_marketId_slug_key" ON "Category"("marketId", "slug");
CREATE INDEX "Category_marketId_idx" ON "Category"("marketId");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Brand.marketId — clone existing brands into AE / TN / OTHER
ALTER TABLE "Brand" ADD COLUMN "marketId" TEXT;

UPDATE "Brand" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

DROP INDEX IF EXISTS "Brand_slug_key";

INSERT INTO "Brand" (
  "id", "name", "slug", "description", "imageUrl",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'brand_ae_' || "id", "name", "slug", "description", "imageUrl",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_ae'
FROM "Brand"
WHERE "marketId" = 'market_other';

INSERT INTO "Brand" (
  "id", "name", "slug", "description", "imageUrl",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'brand_tn_' || "id", "name", "slug", "description", "imageUrl",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_tn'
FROM "Brand"
WHERE "marketId" = 'market_other';

INSERT INTO "BrandTranslation" (
  "id", "brandId", "locale", "name", "description", "createdAt", "updatedAt"
)
SELECT
  'bt_ae_' || t."id", 'brand_ae_' || t."brandId", t."locale", t."name", t."description",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BrandTranslation" t
INNER JOIN "Brand" b ON b."id" = t."brandId"
WHERE b."marketId" = 'market_other';

INSERT INTO "BrandTranslation" (
  "id", "brandId", "locale", "name", "description", "createdAt", "updatedAt"
)
SELECT
  'bt_tn_' || t."id", 'brand_tn_' || t."brandId", t."locale", t."name", t."description",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BrandTranslation" t
INNER JOIN "Brand" b ON b."id" = t."brandId"
WHERE b."marketId" = 'market_other';

UPDATE "Product" p
SET "brandId" = 'brand_ae_' || p."brandId"
WHERE p."marketId" = 'market_ae'
  AND EXISTS (SELECT 1 FROM "Brand" b WHERE b."id" = 'brand_ae_' || p."brandId");

UPDATE "Product" p
SET "brandId" = 'brand_tn_' || p."brandId"
WHERE p."marketId" = 'market_tn'
  AND EXISTS (SELECT 1 FROM "Brand" b WHERE b."id" = 'brand_tn_' || p."brandId");

ALTER TABLE "Brand" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "Brand_marketId_slug_key" ON "Brand"("marketId", "slug");
CREATE INDEX "Brand_marketId_idx" ON "Brand"("marketId");

ALTER TABLE "Brand"
  ADD CONSTRAINT "Brand_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Warehouse.marketId — assign existing to OTHER; clone empty shells for AE / TN
ALTER TABLE "Warehouse" ADD COLUMN "marketId" TEXT;

UPDATE "Warehouse" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

DROP INDEX IF EXISTS "Warehouse_code_key";
DROP INDEX IF EXISTS "Warehouse_isDefault_idx";

INSERT INTO "Warehouse" (
  "id", "name", "code", "line1", "line2", "city", "region", "postalCode", "country",
  "isActive", "isDefault", "createdAt", "updatedAt", "marketId"
)
SELECT
  'wh_ae_' || "id", "name", "code", "line1", "line2", "city", "region", "postalCode", "country",
  "isActive", "isDefault", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_ae'
FROM "Warehouse"
WHERE "marketId" = 'market_other';

INSERT INTO "Warehouse" (
  "id", "name", "code", "line1", "line2", "city", "region", "postalCode", "country",
  "isActive", "isDefault", "createdAt", "updatedAt", "marketId"
)
SELECT
  'wh_tn_' || "id", "name", "code", "line1", "line2", "city", "region", "postalCode", "country",
  "isActive", "isDefault", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_tn'
FROM "Warehouse"
WHERE "marketId" = 'market_other';

ALTER TABLE "Warehouse" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "Warehouse_marketId_code_key" ON "Warehouse"("marketId", "code");
CREATE INDEX "Warehouse_marketId_idx" ON "Warehouse"("marketId");
CREATE INDEX "Warehouse_marketId_isDefault_idx" ON "Warehouse"("marketId", "isDefault");

ALTER TABLE "Warehouse"
  ADD CONSTRAINT "Warehouse_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
