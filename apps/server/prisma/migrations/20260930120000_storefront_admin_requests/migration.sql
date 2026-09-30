CREATE TYPE "CategoryKind" AS ENUM ('CATEGORY', 'PROBLEM');
CREATE TYPE "MailRecipientType" AS ENUM ('NEW_ORDER', 'STOCK_ALERT');

ALTER TABLE "Category"
  ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'CATEGORY',
  ADD COLUMN "parentCategoryId" TEXT;

CREATE INDEX "Category_parentCategoryId_idx" ON "Category"("parentCategoryId");
CREATE INDEX "Category_marketId_kind_idx" ON "Category"("marketId", "kind");
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentCategoryId_fkey"
  FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "_ProductProblems" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ProductProblems_AB_unique" ON "_ProductProblems"("A", "B");
CREATE INDEX "_ProductProblems_B_index" ON "_ProductProblems"("B");
ALTER TABLE "_ProductProblems"
  ADD CONSTRAINT "_ProductProblems_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "_ProductProblems_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer"
  ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order"
  ADD COLUMN "policiesAcceptedAt" TIMESTAMP(3);

ALTER TABLE "StoreSettings"
  ADD COLUMN "mailingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mailLogsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "customerOrderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "adminOrderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "adminStockEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocument_marketId_slug_locale_key" ON "LegalDocument"("marketId", "slug", "locale");
CREATE INDEX "LegalDocument_marketId_slug_idx" ON "LegalDocument"("marketId", "slug");
ALTER TABLE "LegalDocument"
  ADD CONSTRAINT "LegalDocument_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MailRecipient" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "type" "MailRecipientType" NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verificationTokenHash" TEXT,
  "verificationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MailRecipient_marketId_email_type_key" ON "MailRecipient"("marketId", "email", "type");
CREATE UNIQUE INDEX "MailRecipient_verificationTokenHash_key" ON "MailRecipient"("verificationTokenHash");
CREATE INDEX "MailRecipient_marketId_type_verifiedAt_idx" ON "MailRecipient"("marketId", "type", "verifiedAt");
ALTER TABLE "MailRecipient"
  ADD CONSTRAINT "MailRecipient_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
