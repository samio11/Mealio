ALTER TABLE "expenses"
ADD COLUMN "utilityBillPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "utilityBillPaidById" TEXT,
ADD COLUMN "utilityBillPaidAt" TIMESTAMP(3);
