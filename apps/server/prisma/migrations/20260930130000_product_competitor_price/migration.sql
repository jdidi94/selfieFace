ALTER TABLE "Product"
  ADD COLUMN "competitorPriceAmount" INTEGER,
  ADD COLUMN "competitorPriceSource" TEXT,
  ADD COLUMN "competitorPriceCheckedAt" TIMESTAMP(3);
