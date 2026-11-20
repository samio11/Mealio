-- Shared source-backed reference prices are separate from tenant-observed prices.
CREATE TABLE "grocery_master_prices" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "groceryItemId" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "minPricePoisha" BIGINT NOT NULL,
    "maxPricePoisha" BIGINT NOT NULL,
    "referencePricePoisha" BIGINT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checkedOn" DATE NOT NULL,
    "priceType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grocery_master_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grocery_master_prices_sourceItemId_key" ON "grocery_master_prices"("sourceItemId");
CREATE UNIQUE INDEX "grocery_master_prices_groceryItemId_key" ON "grocery_master_prices"("groceryItemId");
CREATE INDEX "grocery_master_prices_isActive_checkedOn_idx" ON "grocery_master_prices"("isActive", "checkedOn");

ALTER TABLE "grocery_master_prices"
ADD CONSTRAINT "grocery_master_prices_groceryItemId_fkey"
FOREIGN KEY ("groceryItemId") REFERENCES "grocery_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
