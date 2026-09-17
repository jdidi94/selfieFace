-- Facebook / Instagram / email: local (TND) vs international (AED/USD)
ALTER TABLE "StoreSettings" RENAME COLUMN "contactFacebook" TO "contactFacebookLocal";
ALTER TABLE "StoreSettings" RENAME COLUMN "contactInstagram" TO "contactInstagramLocal";
ALTER TABLE "StoreSettings" RENAME COLUMN "contactEmail" TO "contactEmailLocal";
ALTER TABLE "StoreSettings" ADD COLUMN "contactFacebookInternational" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "contactInstagramInternational" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "contactEmailInternational" TEXT;
