-- SearchInsight.marketId — existing rows → OTHER (no clone; analytics stay on rest-of-world)
ALTER TABLE "SearchInsight" ADD COLUMN "marketId" TEXT;

UPDATE "SearchInsight" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

ALTER TABLE "SearchInsight" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "SearchInsight_query_locale_key";
DROP INDEX IF EXISTS "SearchInsight_hitCount_idx";

CREATE UNIQUE INDEX "SearchInsight_marketId_query_locale_key"
  ON "SearchInsight"("marketId", "query", "locale");
CREATE INDEX "SearchInsight_marketId_hitCount_idx" ON "SearchInsight"("marketId", "hitCount");
CREATE INDEX "SearchInsight_hitCount_idx" ON "SearchInsight"("hitCount");

ALTER TABLE "SearchInsight"
  ADD CONSTRAINT "SearchInsight_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- JournalArticle.marketId — clone editorial to AE / TN / OTHER for continuity.
-- Product links stay on OTHER only (catalog products live there; AE/TN clones keep gallery + copy).
ALTER TABLE "JournalArticle" ADD COLUMN "marketId" TEXT;

UPDATE "JournalArticle" SET "marketId" = 'market_other' WHERE "marketId" IS NULL;

DROP INDEX IF EXISTS "JournalArticle_slug_key";
DROP INDEX IF EXISTS "JournalArticle_status_idx";

INSERT INTO "JournalArticle" (
  "id", "slug", "status", "publishedAt", "coverMediaId",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'ja_ae_' || "id", "slug", "status", "publishedAt", "coverMediaId",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_ae'
FROM "JournalArticle"
WHERE "marketId" = 'market_other';

INSERT INTO "JournalArticle" (
  "id", "slug", "status", "publishedAt", "coverMediaId",
  "createdAt", "updatedAt", "marketId"
)
SELECT
  'ja_tn_' || "id", "slug", "status", "publishedAt", "coverMediaId",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'market_tn'
FROM "JournalArticle"
WHERE "marketId" = 'market_other';

INSERT INTO "JournalArticleTranslation" (
  "id", "articleId", "locale", "title", "excerpt", "body", "createdAt", "updatedAt"
)
SELECT
  'jat_ae_' || t."id", 'ja_ae_' || t."articleId", t."locale", t."title", t."excerpt", t."body",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "JournalArticleTranslation" t
INNER JOIN "JournalArticle" a ON a."id" = t."articleId"
WHERE a."marketId" = 'market_other';

INSERT INTO "JournalArticleTranslation" (
  "id", "articleId", "locale", "title", "excerpt", "body", "createdAt", "updatedAt"
)
SELECT
  'jat_tn_' || t."id", 'ja_tn_' || t."articleId", t."locale", t."title", t."excerpt", t."body",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "JournalArticleTranslation" t
INNER JOIN "JournalArticle" a ON a."id" = t."articleId"
WHERE a."marketId" = 'market_other';

INSERT INTO "JournalArticleImage" (
  "id", "articleId", "mediaId", "sortOrder", "alt"
)
SELECT
  'jai_ae_' || i."id", 'ja_ae_' || i."articleId", i."mediaId", i."sortOrder", i."alt"
FROM "JournalArticleImage" i
INNER JOIN "JournalArticle" a ON a."id" = i."articleId"
WHERE a."marketId" = 'market_other';

INSERT INTO "JournalArticleImage" (
  "id", "articleId", "mediaId", "sortOrder", "alt"
)
SELECT
  'jai_tn_' || i."id", 'ja_tn_' || i."articleId", i."mediaId", i."sortOrder", i."alt"
FROM "JournalArticleImage" i
INNER JOIN "JournalArticle" a ON a."id" = i."articleId"
WHERE a."marketId" = 'market_other';

-- Intentionally do NOT clone JournalArticleProduct — products are OTHER-only today;
-- AE/TN article clones remain editorial-only until same-market products are linked.

ALTER TABLE "JournalArticle" ALTER COLUMN "marketId" SET NOT NULL;

CREATE UNIQUE INDEX "JournalArticle_marketId_slug_key" ON "JournalArticle"("marketId", "slug");
CREATE INDEX "JournalArticle_marketId_status_idx" ON "JournalArticle"("marketId", "status");
CREATE INDEX "JournalArticle_status_idx" ON "JournalArticle"("status");

ALTER TABLE "JournalArticle"
  ADD CONSTRAINT "JournalArticle_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
