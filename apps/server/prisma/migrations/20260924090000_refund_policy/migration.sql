-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "refundWindowDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "StoreSettings" ADD COLUMN "refundWindowAfterShip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "refundAllowedAfterShipped" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "refundAllowedAfterDelivered" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "refundShippingRefundable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "refundTaxRefundable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "refundRestockingFeeBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StoreSettings" ADD COLUMN "refundDefaultPartialBps" INTEGER;
