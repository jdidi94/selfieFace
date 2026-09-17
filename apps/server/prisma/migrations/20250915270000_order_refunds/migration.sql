-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stripeRefundId" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "refundAmount" INTEGER;
