-- CreateEnum
CREATE TYPE "JournalArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PromoBannerPlacement" AS ENUM ('HOME_HERO', 'HOME_SECONDARY');

-- CreateTable
CREATE TABLE "JournalArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "JournalArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "coverMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoBanner" (
    "id" TEXT NOT NULL,
    "placement" "PromoBannerPlacement" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "href" TEXT,
    "imageMediaId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoBannerTranslation" (
    "id" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoBannerTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalArticle_slug_key" ON "JournalArticle"("slug");

-- CreateIndex
CREATE INDEX "JournalArticle_status_idx" ON "JournalArticle"("status");

-- CreateIndex
CREATE INDEX "JournalArticle_publishedAt_idx" ON "JournalArticle"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalArticleTranslation_articleId_locale_key" ON "JournalArticleTranslation"("articleId", "locale");

-- CreateIndex
CREATE INDEX "JournalArticleTranslation_locale_idx" ON "JournalArticleTranslation"("locale");

-- CreateIndex
CREATE INDEX "PromoBanner_placement_isActive_idx" ON "PromoBanner"("placement", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromoBannerTranslation_bannerId_locale_key" ON "PromoBannerTranslation"("bannerId", "locale");

-- CreateIndex
CREATE INDEX "PromoBannerTranslation_locale_idx" ON "PromoBannerTranslation"("locale");

-- AddForeignKey
ALTER TABLE "JournalArticle" ADD CONSTRAINT "JournalArticle_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalArticleTranslation" ADD CONSTRAINT "JournalArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "JournalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoBanner" ADD CONSTRAINT "PromoBanner_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoBannerTranslation" ADD CONSTRAINT "PromoBannerTranslation_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "PromoBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
