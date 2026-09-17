-- Guest commerce: optional customer accounts + guest order access tokens

ALTER TABLE "Customer" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Customer" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

CREATE INDEX "Customer_isGuest_idx" ON "Customer"("isGuest");

ALTER TABLE "Order" ADD COLUMN "guestAccessToken" TEXT;

CREATE UNIQUE INDEX "Order_guestAccessToken_key" ON "Order"("guestAccessToken");
