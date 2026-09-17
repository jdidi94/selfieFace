-- Mono-market storefront contact (one set per StoreSettings / market window).
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "contactWhatsapp" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "contactFacebook" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "contactInstagram" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

UPDATE "StoreSettings" SET
  "contactWhatsapp" = CASE
    WHEN "id" = 'TN' THEN COALESCE("contactWhatsappLocal", "contactWhatsappInternational")
    ELSE COALESCE("contactWhatsappInternational", "contactWhatsappLocal")
  END,
  "contactPhone" = CASE
    WHEN "id" = 'TN' THEN COALESCE("contactPhoneLocal", "contactPhoneInternational")
    ELSE COALESCE("contactPhoneInternational", "contactPhoneLocal")
  END,
  "contactFacebook" = CASE
    WHEN "id" = 'TN' THEN COALESCE("contactFacebookLocal", "contactFacebookInternational")
    ELSE COALESCE("contactFacebookInternational", "contactFacebookLocal")
  END,
  "contactInstagram" = CASE
    WHEN "id" = 'TN' THEN COALESCE("contactInstagramLocal", "contactInstagramInternational")
    ELSE COALESCE("contactInstagramInternational", "contactInstagramLocal")
  END,
  "contactEmail" = CASE
    WHEN "id" = 'TN' THEN COALESCE("contactEmailLocal", "contactEmailInternational")
    ELSE COALESCE("contactEmailInternational", "contactEmailLocal")
  END
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'StoreSettings' AND column_name = 'contactWhatsappLocal'
);

ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactWhatsappLocal";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactPhoneLocal";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactFacebookLocal";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactInstagramLocal";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactEmailLocal";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactWhatsappInternational";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactPhoneInternational";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactFacebookInternational";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactInstagramInternational";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "contactEmailInternational";

-- Coupons: market-currency amount + customer description.
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "amountOff" INTEGER;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "minSubtotal" INTEGER;

UPDATE "Coupon" AS c
SET
  "amountOff" = CASE m."code"
    WHEN 'TN' THEN c."amountOffTnd"
    WHEN 'AE' THEN c."amountOffAed"
    ELSE c."amountOffUsd"
  END,
  "minSubtotal" = CASE m."code"
    WHEN 'TN' THEN c."minSubtotalTnd"
    WHEN 'AE' THEN c."minSubtotalAed"
    ELSE c."minSubtotalUsd"
  END
FROM "Market" AS m
WHERE m."id" = c."marketId"
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Coupon' AND column_name = 'amountOffUsd'
  );

ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "amountOffUsd";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "amountOffTnd";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "amountOffAed";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "minSubtotalUsd";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "minSubtotalTnd";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "minSubtotalAed";
