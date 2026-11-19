ALTER TYPE "PaymentMethod" ADD VALUE 'CARD';

ALTER TYPE "ExpenseCategory" ADD VALUE 'WATER';
ALTER TYPE "ExpenseCategory" ADD VALUE 'MAID';
ALTER TYPE "ExpenseCategory" ADD VALUE 'GARBAGE';

CREATE TYPE "UtilityPaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "utility_payments" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPoisha" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "status" "UtilityPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "utility_payments_expenseId_memberId_key"
ON "utility_payments"("expenseId", "memberId");

CREATE INDEX "utility_payments_expenseId_status_idx"
ON "utility_payments"("expenseId", "status");

CREATE INDEX "utility_payments_memberId_idx"
ON "utility_payments"("memberId");

ALTER TABLE "utility_payments"
ADD CONSTRAINT "utility_payments_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "utility_payments"
ADD CONSTRAINT "utility_payments_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deposits" ADD COLUMN "utilityPaymentId" TEXT;

CREATE UNIQUE INDEX "deposits_utilityPaymentId_key"
ON "deposits"("utilityPaymentId");

ALTER TABLE "deposits"
ADD CONSTRAINT "deposits_utilityPaymentId_fkey"
FOREIGN KEY ("utilityPaymentId") REFERENCES "utility_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
