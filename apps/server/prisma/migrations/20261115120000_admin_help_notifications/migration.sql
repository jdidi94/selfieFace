ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "StoreSettings"
  ADD COLUMN "adminHelpNotesEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "adminInsightsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "adminInsightEmailsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AdminHelpNote" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "contentEn" TEXT NOT NULL,
  "contentAr" TEXT,
  "contentFr" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminHelpNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminHelpNote_marketId_fieldKey_key" ON "AdminHelpNote"("marketId", "fieldKey");
CREATE INDEX "AdminHelpNote_marketId_isActive_idx" ON "AdminHelpNote"("marketId", "isActive");
ALTER TABLE "AdminHelpNote" ADD CONSTRAINT "AdminHelpNote_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdminNotification" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "source" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNotification_marketId_dedupeKey_key" ON "AdminNotification"("marketId", "dedupeKey");
CREATE INDEX "AdminNotification_marketId_status_createdAt_idx" ON "AdminNotification"("marketId", "status", "createdAt");
CREATE INDEX "AdminNotification_marketId_dueAt_idx" ON "AdminNotification"("marketId", "dueAt");
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
