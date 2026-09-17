-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'TND', 'AED');

-- CreateTable
CREATE TABLE "VariantPrice" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "compareAtAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VariantPrice_pkey" PRIMARY KEY ("id")
);

-- Migrate existing EUR-as-cents prices into USD (dev seed values)
INSERT INTO "VariantPrice" ("id", "variantId", "currency", "amount", "compareAtAmount", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text)::text,
  "id",
  'USD'::"Currency",
  "price",
  "compareAtPrice",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductVariant";

-- Also seed TND (~3.1x) and AED (~3.67x) approximations from USD for existing rows
INSERT INTO "VariantPrice" ("id", "variantId", "currency", "amount", "compareAtAmount", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || 'tnd')::text,
  "variantId",
  'TND'::"Currency",
  ROUND("amount" * 3.1)::INTEGER,
  CASE WHEN "compareAtAmount" IS NULL THEN NULL ELSE ROUND("compareAtAmount" * 3.1)::INTEGER END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "VariantPrice" WHERE "currency" = 'USD';

INSERT INTO "VariantPrice" ("id", "variantId", "currency", "amount", "compareAtAmount", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || 'aed')::text,
  "variantId",
  'AED'::"Currency",
  ROUND("amount" * 3.67)::INTEGER,
  CASE WHEN "compareAtAmount" IS NULL THEN NULL ELSE ROUND("compareAtAmount" * 3.67)::INTEGER END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "VariantPrice" WHERE "currency" = 'USD';

-- Drop legacy single-currency columns
ALTER TABLE "ProductVariant" DROP COLUMN "price";
ALTER TABLE "ProductVariant" DROP COLUMN "compareAtPrice";

-- CreateIndex
CREATE INDEX "VariantPrice_currency_idx" ON "VariantPrice"("currency");
CREATE UNIQUE INDEX "VariantPrice_variantId_currency_key" ON "VariantPrice"("variantId", "currency");

-- AddForeignKey
ALTER TABLE "VariantPrice" ADD CONSTRAINT "VariantPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
