-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentTranslation" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeTranslation" (
    "id" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypeTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkinConcern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinConcern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkinConcernTranslation" (
    "id" TEXT NOT NULL,
    "skinConcernId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinConcernTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientTranslation" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IngredientToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IngredientToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProductToProductType" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToProductType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProductToSkinConcern" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToSkinConcern_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Department_marketId_isActive_sortOrder_idx" ON "Department"("marketId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Department_marketId_slug_key" ON "Department"("marketId", "slug");

-- CreateIndex
CREATE INDEX "DepartmentTranslation_locale_idx" ON "DepartmentTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentTranslation_departmentId_locale_key" ON "DepartmentTranslation"("departmentId", "locale");

-- CreateIndex
CREATE INDEX "ProductType_marketId_isActive_sortOrder_idx" ON "ProductType"("marketId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductType_departmentId_sortOrder_idx" ON "ProductType"("departmentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_marketId_slug_key" ON "ProductType"("marketId", "slug");

-- CreateIndex
CREATE INDEX "ProductTypeTranslation_locale_idx" ON "ProductTypeTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeTranslation_productTypeId_locale_key" ON "ProductTypeTranslation"("productTypeId", "locale");

-- CreateIndex
CREATE INDEX "SkinConcern_marketId_isActive_sortOrder_idx" ON "SkinConcern"("marketId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SkinConcern_marketId_slug_key" ON "SkinConcern"("marketId", "slug");

-- CreateIndex
CREATE INDEX "SkinConcernTranslation_locale_idx" ON "SkinConcernTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "SkinConcernTranslation_skinConcernId_locale_key" ON "SkinConcernTranslation"("skinConcernId", "locale");

-- CreateIndex
CREATE INDEX "Ingredient_marketId_isActive_sortOrder_idx" ON "Ingredient"("marketId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_marketId_slug_key" ON "Ingredient"("marketId", "slug");

-- CreateIndex
CREATE INDEX "IngredientTranslation_locale_idx" ON "IngredientTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientTranslation_ingredientId_locale_key" ON "IngredientTranslation"("ingredientId", "locale");

-- CreateIndex
CREATE INDEX "_IngredientToProduct_B_index" ON "_IngredientToProduct"("B");

-- CreateIndex
CREATE INDEX "_ProductToProductType_B_index" ON "_ProductToProductType"("B");

-- CreateIndex
CREATE INDEX "_ProductToSkinConcern_B_index" ON "_ProductToSkinConcern"("B");

-- CreateIndex
CREATE INDEX "Product_departmentId_idx" ON "Product"("departmentId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTranslation" ADD CONSTRAINT "DepartmentTranslation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeTranslation" ADD CONSTRAINT "ProductTypeTranslation_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkinConcern" ADD CONSTRAINT "SkinConcern_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkinConcernTranslation" ADD CONSTRAINT "SkinConcernTranslation_skinConcernId_fkey" FOREIGN KEY ("skinConcernId") REFERENCES "SkinConcern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientTranslation" ADD CONSTRAINT "IngredientTranslation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientToProduct" ADD CONSTRAINT "_IngredientToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientToProduct" ADD CONSTRAINT "_IngredientToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToProductType" ADD CONSTRAINT "_ProductToProductType_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToProductType" ADD CONSTRAINT "_ProductToProductType_B_fkey" FOREIGN KEY ("B") REFERENCES "ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToSkinConcern" ADD CONSTRAINT "_ProductToSkinConcern_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToSkinConcern" ADD CONSTRAINT "_ProductToSkinConcern_B_fkey" FOREIGN KEY ("B") REFERENCES "SkinConcern"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve existing navigation and concern assignments in the new independent taxonomy.
INSERT INTO "Department" ("id", "name", "slug", "description", "sortOrder", "marketId", "createdAt", "updatedAt")
SELECT 'dept_' || c."id", c."name", c."slug", c."description", c."sortOrder", c."marketId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Category" c WHERE c."kind" = 'CATEGORY'
ON CONFLICT ("marketId", "slug") DO NOTHING;

INSERT INTO "DepartmentTranslation" ("id", "departmentId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT 'dept_tr_' || ct."id", d."id", ct."locale", ct."name", ct."description", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CategoryTranslation" ct
JOIN "Category" c ON c."id" = ct."categoryId" AND c."kind" = 'CATEGORY'
JOIN "Department" d ON d."marketId" = c."marketId" AND d."slug" = c."slug"
ON CONFLICT ("departmentId", "locale") DO NOTHING;

UPDATE "Product" p SET "departmentId" = d."id"
FROM "Category" c JOIN "Department" d ON d."marketId" = c."marketId" AND d."slug" = c."slug"
WHERE p."categoryId" = c."id" AND c."kind" = 'CATEGORY';

INSERT INTO "SkinConcern" ("id", "name", "slug", "description", "sortOrder", "marketId", "createdAt", "updatedAt")
SELECT 'concern_' || c."id", c."name", c."slug", c."description", c."sortOrder", c."marketId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Category" c WHERE c."kind" = 'PROBLEM'
ON CONFLICT ("marketId", "slug") DO NOTHING;

INSERT INTO "SkinConcernTranslation" ("id", "skinConcernId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT 'concern_tr_' || ct."id", sc."id", ct."locale", ct."name", ct."description", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CategoryTranslation" ct
JOIN "Category" c ON c."id" = ct."categoryId" AND c."kind" = 'PROBLEM'
JOIN "SkinConcern" sc ON sc."marketId" = c."marketId" AND sc."slug" = c."slug"
ON CONFLICT ("skinConcernId", "locale") DO NOTHING;

INSERT INTO "_ProductToSkinConcern" ("A", "B")
SELECT DISTINCT p."id", sc."id"
FROM "_ProductProblems" pp
JOIN "Product" p ON p."id" = pp."A"
JOIN "Category" c ON c."id" = pp."B" AND c."kind" = 'PROBLEM'
JOIN "SkinConcern" sc ON sc."marketId" = c."marketId" AND sc."slug" = c."slug"
ON CONFLICT ("A", "B") DO NOTHING;
