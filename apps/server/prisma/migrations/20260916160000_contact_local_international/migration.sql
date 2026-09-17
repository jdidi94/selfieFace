-- Local (TND) vs international (AED/USD) phone & WhatsApp contacts
ALTER TABLE "StoreSettings" RENAME COLUMN "contactWhatsapp" TO "contactWhatsappLocal";
ALTER TABLE "StoreSettings" RENAME COLUMN "contactPhone" TO "contactPhoneLocal";
ALTER TABLE "StoreSettings" ADD COLUMN "contactWhatsappInternational" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "contactPhoneInternational" TEXT;
