-- Optional free shipping per storefront currency (cookie)
ALTER TABLE "StoreSettings" ADD COLUMN "freeShippingEnabledUsd" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "freeShippingEnabledTnd" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "freeShippingEnabledAed" BOOLEAN NOT NULL DEFAULT true;
