-- AlterTable
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BehaviorEvent" ADD COLUMN "userId" TEXT;

-- AlterEnum
ALTER TYPE "EmailTemplateType" ADD VALUE 'ACCOUNT_BLOCKED';
ALTER TYPE "EmailTemplateType" ADD VALUE 'ACCOUNT_UNBLOCKED';

-- CreateIndex
CREATE INDEX "BehaviorEvent_userId_createdAt_idx" ON "BehaviorEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
