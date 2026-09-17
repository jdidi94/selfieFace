-- CreateEnum
CREATE TYPE "MerchandisingRailKind" AS ENUM ('TOP', 'NEW', 'INCOMING');

-- CreateEnum
CREATE TYPE "BehaviorEventType" AS ENUM ('SEARCH', 'PRODUCT_CLICK');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "popularityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isIncoming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "incomingAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Product_popularityScore_idx" ON "Product"("popularityScore");

-- CreateIndex
CREATE INDEX "Product_isIncoming_idx" ON "Product"("isIncoming");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateTable
CREATE TABLE "MerchandisingRailItem" (
    "id" TEXT NOT NULL,
    "rail" "MerchandisingRailKind" NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchandisingRailItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchInsight" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorEvent" (
    "id" TEXT NOT NULL,
    "type" "BehaviorEventType" NOT NULL,
    "productId" TEXT,
    "query" TEXT,
    "locale" "Locale",
    "path" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchandisingRailItem_rail_productId_key" ON "MerchandisingRailItem"("rail", "productId");

-- CreateIndex
CREATE INDEX "MerchandisingRailItem_rail_sortOrder_idx" ON "MerchandisingRailItem"("rail", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SearchInsight_query_locale_key" ON "SearchInsight"("query", "locale");

-- CreateIndex
CREATE INDEX "SearchInsight_hitCount_idx" ON "SearchInsight"("hitCount");

-- CreateIndex
CREATE INDEX "SearchInsight_lastSeenAt_idx" ON "SearchInsight"("lastSeenAt");

-- CreateIndex
CREATE INDEX "BehaviorEvent_type_createdAt_idx" ON "BehaviorEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorEvent_productId_idx" ON "BehaviorEvent"("productId");

-- CreateIndex
CREATE INDEX "BehaviorEvent_sessionId_idx" ON "BehaviorEvent"("sessionId");

-- AddForeignKey
ALTER TABLE "MerchandisingRailItem" ADD CONSTRAINT "MerchandisingRailItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
