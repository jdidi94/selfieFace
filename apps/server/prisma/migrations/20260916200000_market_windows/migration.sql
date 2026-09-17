-- CreateEnum
CREATE TYPE "MarketCode" AS ENUM ('AE', 'TN', 'OTHER');

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "code" "MarketCode" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_code_key" ON "Market"("code");

-- Seed three market windows (stable ids for FK backfill)
INSERT INTO "Market" ("id", "code", "name", "currency", "enabled", "createdAt", "updatedAt")
VALUES
  ('market_ae', 'AE', 'Emirates', 'AED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('market_tn', 'TN', 'Tunisia', 'TND', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('market_other', 'OTHER', 'Rest of world', 'USD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- StoreSettings: migrate single default row → one row per market
ALTER TABLE "StoreSettings" ADD COLUMN "marketId" TEXT;

-- Copy existing default settings into OTHER (preserve payment/shipping/contacts)
UPDATE "StoreSettings"
SET "id" = 'OTHER', "marketId" = 'market_other'
WHERE "id" = 'default';

-- If no settings existed, create OTHER
INSERT INTO "StoreSettings" ("id", "marketId", "updatedAt")
SELECT 'OTHER', 'market_other', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "StoreSettings" WHERE "id" = 'OTHER');

-- Clone OTHER settings into AE and TN (same config starting point; admin tunes per window)
INSERT INTO "StoreSettings" (
  "id", "marketId", "taxRateBps",
  "freeShippingEnabledUsd", "freeShippingEnabledTnd", "freeShippingEnabledAed",
  "freeShippingThresholdUsd", "freeShippingThresholdTnd", "freeShippingThresholdAed",
  "domesticShippingUsd", "domesticShippingTnd", "domesticShippingAed",
  "internationalShippingUsd", "internationalShippingTnd", "internationalShippingAed",
  "domesticCountries",
  "cashOnDeliveryEnabled", "cardPaymentEnabled",
  "stripeEnabled", "stripeSecretKey", "stripePublishableKey",
  "konnectEnabled", "konnectApiKey", "konnectWalletId", "konnectSandbox",
  "contactWhatsappLocal", "contactPhoneLocal", "contactFacebookLocal", "contactInstagramLocal", "contactEmailLocal",
  "contactWhatsappInternational", "contactPhoneInternational", "contactFacebookInternational", "contactInstagramInternational", "contactEmailInternational",
  "lowStockThreshold",
  "loyaltyEnabled", "loyaltyPointsPerMajorUnit", "loyaltyPointValueMinor",
  "loyaltyMinOrderMinor", "loyaltyMaxRedeemBps", "loyaltySignupBonusPoints",
  "updatedAt"
)
SELECT
  'AE', 'market_ae', "taxRateBps",
  "freeShippingEnabledUsd", "freeShippingEnabledTnd", "freeShippingEnabledAed",
  "freeShippingThresholdUsd", "freeShippingThresholdTnd", "freeShippingThresholdAed",
  "domesticShippingUsd", "domesticShippingTnd", "domesticShippingAed",
  "internationalShippingUsd", "internationalShippingTnd", "internationalShippingAed",
  "domesticCountries",
  "cashOnDeliveryEnabled", "cardPaymentEnabled",
  "stripeEnabled", "stripeSecretKey", "stripePublishableKey",
  "konnectEnabled", "konnectApiKey", "konnectWalletId", "konnectSandbox",
  "contactWhatsappLocal", "contactPhoneLocal", "contactFacebookLocal", "contactInstagramLocal", "contactEmailLocal",
  "contactWhatsappInternational", "contactPhoneInternational", "contactFacebookInternational", "contactInstagramInternational", "contactEmailInternational",
  "lowStockThreshold",
  "loyaltyEnabled", "loyaltyPointsPerMajorUnit", "loyaltyPointValueMinor",
  "loyaltyMinOrderMinor", "loyaltyMaxRedeemBps", "loyaltySignupBonusPoints",
  CURRENT_TIMESTAMP
FROM "StoreSettings" WHERE "id" = 'OTHER'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoreSettings" (
  "id", "marketId", "taxRateBps",
  "freeShippingEnabledUsd", "freeShippingEnabledTnd", "freeShippingEnabledAed",
  "freeShippingThresholdUsd", "freeShippingThresholdTnd", "freeShippingThresholdAed",
  "domesticShippingUsd", "domesticShippingTnd", "domesticShippingAed",
  "internationalShippingUsd", "internationalShippingTnd", "internationalShippingAed",
  "domesticCountries",
  "cashOnDeliveryEnabled", "cardPaymentEnabled",
  "stripeEnabled", "stripeSecretKey", "stripePublishableKey",
  "konnectEnabled", "konnectApiKey", "konnectWalletId", "konnectSandbox",
  "contactWhatsappLocal", "contactPhoneLocal", "contactFacebookLocal", "contactInstagramLocal", "contactEmailLocal",
  "contactWhatsappInternational", "contactPhoneInternational", "contactFacebookInternational", "contactInstagramInternational", "contactEmailInternational",
  "lowStockThreshold",
  "loyaltyEnabled", "loyaltyPointsPerMajorUnit", "loyaltyPointValueMinor",
  "loyaltyMinOrderMinor", "loyaltyMaxRedeemBps", "loyaltySignupBonusPoints",
  "updatedAt"
)
SELECT
  'TN', 'market_tn', "taxRateBps",
  "freeShippingEnabledUsd", "freeShippingEnabledTnd", "freeShippingEnabledAed",
  "freeShippingThresholdUsd", "freeShippingThresholdTnd", "freeShippingThresholdAed",
  "domesticShippingUsd", "domesticShippingTnd", "domesticShippingAed",
  "internationalShippingUsd", "internationalShippingTnd", "internationalShippingAed",
  "domesticCountries",
  "cashOnDeliveryEnabled", "cardPaymentEnabled",
  "stripeEnabled", "stripeSecretKey", "stripePublishableKey",
  "konnectEnabled", "konnectApiKey", "konnectWalletId", "konnectSandbox",
  "contactWhatsappLocal", "contactPhoneLocal", "contactFacebookLocal", "contactInstagramLocal", "contactEmailLocal",
  "contactWhatsappInternational", "contactPhoneInternational", "contactFacebookInternational", "contactInstagramInternational", "contactEmailInternational",
  "lowStockThreshold",
  "loyaltyEnabled", "loyaltyPointsPerMajorUnit", "loyaltyPointValueMinor",
  "loyaltyMinOrderMinor", "loyaltyMaxRedeemBps", "loyaltySignupBonusPoints",
  CURRENT_TIMESTAMP
FROM "StoreSettings" WHERE "id" = 'OTHER'
ON CONFLICT ("id") DO NOTHING;

-- Drop any leftover non-market settings rows
DELETE FROM "StoreSettings" WHERE "marketId" IS NULL;

ALTER TABLE "StoreSettings" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "StoreSettings_marketId_key" ON "StoreSettings"("marketId");

ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Product.marketId — existing catalog → OTHER
ALTER TABLE "Product" ADD COLUMN "marketId" TEXT;

UPDATE "Product" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "Product_slug_key";

CREATE UNIQUE INDEX "Product_marketId_slug_key" ON "Product"("marketId", "slug");
CREATE INDEX "Product_marketId_idx" ON "Product"("marketId");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PromoBanner.marketId — existing → OTHER
ALTER TABLE "PromoBanner" ADD COLUMN "marketId" TEXT;

UPDATE "PromoBanner" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "PromoBanner" ALTER COLUMN "marketId" SET NOT NULL;

CREATE INDEX "PromoBanner_marketId_placement_isActive_idx" ON "PromoBanner"("marketId", "placement", "isActive");

ALTER TABLE "PromoBanner"
  ADD CONSTRAINT "PromoBanner_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coupon.marketId — existing → OTHER; code unique per market
ALTER TABLE "Coupon" ADD COLUMN "marketId" TEXT;

UPDATE "Coupon" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "Coupon" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "Coupon_code_key";

CREATE UNIQUE INDEX "Coupon_marketId_code_key" ON "Coupon"("marketId", "code");
CREATE INDEX "Coupon_marketId_idx" ON "Coupon"("marketId");

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
