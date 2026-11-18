ALTER TABLE "Order"
  ADD COLUMN "stockReservedAt" TIMESTAMP(3),
  ADD COLUMN "stockHoldExpiresAt" TIMESTAMP(3),
  ADD COLUMN "stockCommittedAt" TIMESTAMP(3);

CREATE INDEX "Order_status_paymentStatus_stockHoldExpiresAt_idx"
  ON "Order"("status", "paymentStatus", "stockHoldExpiresAt");

ALTER TABLE "OrderItemAllocation" ADD COLUMN "variantId" TEXT;
UPDATE "OrderItemAllocation" AS allocation
SET "variantId" = item."variantId"
FROM "OrderItem" AS item
WHERE allocation."orderItemId" = item."id";
ALTER TABLE "OrderItemAllocation" ALTER COLUMN "variantId" SET NOT NULL;

CREATE INDEX "OrderItemAllocation_variantId_idx"
  ON "OrderItemAllocation"("variantId");
ALTER TABLE "OrderItemAllocation"
  ADD CONSTRAINT "OrderItemAllocation_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
