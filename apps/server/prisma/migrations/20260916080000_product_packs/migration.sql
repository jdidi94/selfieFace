-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'PACK');

-- AlterEnum
ALTER TYPE "MerchandisingRailKind" ADD VALUE 'TOP_PACKS';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT';

-- CreateIndex
CREATE INDEX "Product_kind_idx" ON "Product"("kind");

-- CreateTable
CREATE TABLE "PackComponent" (
    "id" TEXT NOT NULL,
    "packProductId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackComponent_packProductId_sortOrder_idx" ON "PackComponent"("packProductId", "sortOrder");

-- CreateIndex
CREATE INDEX "PackComponent_variantId_idx" ON "PackComponent"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PackComponent_packProductId_variantId_key" ON "PackComponent"("packProductId", "variantId");

-- AddForeignKey
ALTER TABLE "PackComponent" ADD CONSTRAINT "PackComponent_packProductId_fkey" FOREIGN KEY ("packProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackComponent" ADD CONSTRAINT "PackComponent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
