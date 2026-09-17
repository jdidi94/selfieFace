-- AlterTable StoreSettings payment config
ALTER TABLE "StoreSettings" ADD COLUMN "cashOnDeliveryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "cardPaymentEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "stripeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "stripeSecretKey" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "stripePublishableKey" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "konnectEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "konnectApiKey" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "konnectWalletId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "konnectSandbox" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Order payment provider
ALTER TABLE "Order" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "Order" ADD COLUMN "konnectPaymentRef" TEXT;

CREATE UNIQUE INDEX "Order_konnectPaymentRef_key" ON "Order"("konnectPaymentRef");
