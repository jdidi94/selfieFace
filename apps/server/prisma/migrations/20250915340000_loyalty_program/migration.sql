-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltyPointsPerMajorUnit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltyPointValueMinor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltyMinOrderMinor" INTEGER;
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltyMaxRedeemBps" INTEGER;
ALTER TABLE "StoreSettings" ADD COLUMN "loyaltySignupBonusPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "loyaltyPointsToRedeem" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "LoyaltyLedgerType" AS ENUM (
  'EARN_ORDER',
  'REDEEM_ORDER',
  'SIGNUP_BONUS',
  'ADJUST',
  'EARN_REVERSAL',
  'REDEEM_RESTORE'
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "LoyaltyLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customerId_key" ON "LoyaltyAccount"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_accountId_createdAt_idx" ON "LoyaltyLedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_orderId_idx" ON "LoyaltyLedgerEntry"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLedgerEntry_orderId_type_key" ON "LoyaltyLedgerEntry"("orderId", "type");

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
