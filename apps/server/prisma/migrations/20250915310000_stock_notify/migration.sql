-- CreateTable
CREATE TABLE "StockNotifySubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "customerId" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockNotifySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockNotifySubscription_email_idx" ON "StockNotifySubscription"("email");

-- CreateIndex
CREATE INDEX "StockNotifySubscription_productId_idx" ON "StockNotifySubscription"("productId");

-- CreateIndex
CREATE INDEX "StockNotifySubscription_variantId_idx" ON "StockNotifySubscription"("variantId");

-- CreateIndex
CREATE INDEX "StockNotifySubscription_notifiedAt_idx" ON "StockNotifySubscription"("notifiedAt");

-- CreateIndex
CREATE INDEX "StockNotifySubscription_createdAt_idx" ON "StockNotifySubscription"("createdAt");

-- AddForeignKey
ALTER TABLE "StockNotifySubscription" ADD CONSTRAINT "StockNotifySubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockNotifySubscription" ADD CONSTRAINT "StockNotifySubscription_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockNotifySubscription" ADD CONSTRAINT "StockNotifySubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
