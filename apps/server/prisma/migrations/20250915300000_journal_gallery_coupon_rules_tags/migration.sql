-- CreateEnum
CREATE TYPE "CouponProductScope" AS ENUM ('ALL', 'INCLUDE', 'EXCLUDE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "productScope" "CouponProductScope" NOT NULL DEFAULT 'ALL',
ADD COLUMN "productTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "ruleIsNew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ruleMinPriceUsd" INTEGER,
ADD COLUMN "ruleMinRating" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "JournalArticleImage" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,

    CONSTRAINT "JournalArticleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalArticleProduct" (
    "articleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JournalArticleProduct_pkey" PRIMARY KEY ("articleId","productId")
);

-- CreateIndex
CREATE INDEX "JournalArticleImage_articleId_idx" ON "JournalArticleImage"("articleId");

-- CreateIndex
CREATE INDEX "JournalArticleProduct_productId_idx" ON "JournalArticleProduct"("productId");

-- AddForeignKey
ALTER TABLE "JournalArticleImage" ADD CONSTRAINT "JournalArticleImage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "JournalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalArticleImage" ADD CONSTRAINT "JournalArticleImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalArticleProduct" ADD CONSTRAINT "JournalArticleProduct_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "JournalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalArticleProduct" ADD CONSTRAINT "JournalArticleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
