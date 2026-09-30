-- AlterEnum
ALTER TYPE "BehaviorEventType" ADD VALUE 'PAGE_VIEW';

-- AlterTable
ALTER TABLE "BehaviorEvent" ADD COLUMN "marketId" TEXT;

-- CreateIndex
CREATE INDEX "BehaviorEvent_marketId_type_createdAt_idx" ON "BehaviorEvent"("marketId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
