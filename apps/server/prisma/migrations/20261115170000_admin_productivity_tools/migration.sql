CREATE TABLE "AdminSavedFilter" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSavedFilter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminChangeHistory" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "adminUserId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityName" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminChangeHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSavedFilter_marketId_ownerUserId_entity_name_key"
  ON "AdminSavedFilter"("marketId", "ownerUserId", "entity", "name");
CREATE INDEX "AdminSavedFilter_marketId_entity_isShared_idx"
  ON "AdminSavedFilter"("marketId", "entity", "isShared");
CREATE INDEX "AdminSavedFilter_ownerUserId_entity_idx"
  ON "AdminSavedFilter"("ownerUserId", "entity");
CREATE INDEX "AdminChangeHistory_marketId_createdAt_idx"
  ON "AdminChangeHistory"("marketId", "createdAt");
CREATE INDEX "AdminChangeHistory_marketId_entityType_createdAt_idx"
  ON "AdminChangeHistory"("marketId", "entityType", "createdAt");
CREATE INDEX "AdminChangeHistory_entityId_createdAt_idx"
  ON "AdminChangeHistory"("entityId", "createdAt");

ALTER TABLE "AdminSavedFilter"
  ADD CONSTRAINT "AdminSavedFilter_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSavedFilter"
  ADD CONSTRAINT "AdminSavedFilter_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminChangeHistory"
  ADD CONSTRAINT "AdminChangeHistory_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminChangeHistory"
  ADD CONSTRAINT "AdminChangeHistory_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
