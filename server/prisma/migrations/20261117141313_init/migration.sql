-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MessRole" AS ENUM ('MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MonthStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MealRatePolicy" AS ENUM ('EXPENSES_OVER_MEALS');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "MealRecordStatus" AS ENUM ('ON', 'OFF');

-- CreateEnum
CREATE TYPE "MealChangeSource" AS ENUM ('MEMBER', 'MANAGER_OVERRIDE', 'SYSTEM_DEFAULT');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'DOZEN', 'PACKET', 'BOTTLE');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANAGER_ENTRY', 'VERIFIED_PURCHASE', 'ADMIN_REFERENCE', 'RETAILER_FEED', 'AI_ESTIMATE');

-- CreateEnum
CREATE TYPE "PriceVerification" AS ENUM ('UNVERIFIED', 'VERIFIED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MEAL_BAZAR', 'RENT', 'ELECTRICITY', 'GAS', 'WIFI', 'CLEANING', 'OTHER_SHARED', 'MEMBER_SPECIFIC', 'REFUND_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('EQUAL', 'MEAL_COUNT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BazarStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('BAZAR_PHOTO', 'RECEIPT', 'AVATAR', 'PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "AIExtractionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'bn',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_memberships" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MessRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT,
    "phone" TEXT,
    "isDutyEligible" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_invitations" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "MessRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_months" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MonthStatus" NOT NULL DEFAULT 'OPEN',
    "openingCashPoisha" BIGINT NOT NULL DEFAULT 0,
    "budgetPoisha" BIGINT NOT NULL DEFAULT 0,
    "mealRatePolicy" "MealRatePolicy" NOT NULL DEFAULT 'EXPENSES_OVER_MEALS',
    "settingsSnapshot" JSONB,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_type_settings" (
    "id" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultOn" BOOLEAN NOT NULL DEFAULT true,
    "cutoffMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_type_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_records" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "status" "MealRecordStatus" NOT NULL,
    "source" "MealChangeSource" NOT NULL DEFAULT 'MEMBER',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menus" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "menuText" TEXT NOT NULL,
    "noticeText" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_items" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "unit" "Unit" NOT NULL DEFAULT 'KG',
    "brand" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grocery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_prices" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "groceryItemId" TEXT NOT NULL,
    "pricePoisha" BIGINT NOT NULL,
    "unit" "Unit" NOT NULL,
    "source" "PriceSource" NOT NULL,
    "verification" "PriceVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "shopName" TEXT,
    "location" TEXT,
    "observedOn" DATE NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grocery_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPoisha" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountPoisha" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "allocationMethod" "AllocationMethod" NOT NULL DEFAULT 'EQUAL',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "incurredOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reversalOfId" TEXT,
    "bazarEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_allocations" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPoisha" BIGINT NOT NULL,
    "mealCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_adjustments" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amountPoisha" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bazar_entries" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "buyerMemberId" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "shopName" TEXT,
    "totalPoisha" BIGINT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "status" "BazarStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bazar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bazar_entry_items" (
    "id" TEXT NOT NULL,
    "bazarEntryId" TEXT NOT NULL,
    "groceryItemId" TEXT,
    "itemNameSnapshot" TEXT NOT NULL,
    "itemNameBnSnapshot" TEXT,
    "unitSnapshot" "Unit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPricePoisha" BIGINT NOT NULL,
    "lineTotalPoisha" BIGINT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" "PriceSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bazar_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bazar_duties" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assigneeMemberId" TEXT,
    "status" "DutyStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bazar_duties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'BAZAR_PHOTO',
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "secureUrl" TEXT,
    "bytes" INTEGER,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bazarEntryId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extractions" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "bazarEntryId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" "AIExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "parsed" JSONB,
    "confidence" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "tokensPrompt" INTEGER,
    "tokensCompletion" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "messes_createdById_idx" ON "messes"("createdById");

-- CreateIndex
CREATE INDEX "mess_memberships_userId_idx" ON "mess_memberships"("userId");

-- CreateIndex
CREATE INDEX "mess_memberships_messId_status_idx" ON "mess_memberships"("messId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mess_memberships_messId_userId_key" ON "mess_memberships"("messId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "mess_invitations_token_key" ON "mess_invitations"("token");

-- CreateIndex
CREATE INDEX "mess_invitations_messId_status_idx" ON "mess_invitations"("messId", "status");

-- CreateIndex
CREATE INDEX "mess_invitations_email_idx" ON "mess_invitations"("email");

-- CreateIndex
CREATE INDEX "mess_months_messId_status_idx" ON "mess_months"("messId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mess_months_messId_year_month_key" ON "mess_months"("messId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "meal_type_settings_monthId_mealType_key" ON "meal_type_settings"("monthId", "mealType");

-- CreateIndex
CREATE INDEX "meal_records_monthId_date_idx" ON "meal_records"("monthId", "date");

-- CreateIndex
CREATE INDEX "meal_records_messId_date_idx" ON "meal_records"("messId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_records_messId_memberId_date_mealType_key" ON "meal_records"("messId", "memberId", "date", "mealType");

-- CreateIndex
CREATE INDEX "daily_menus_monthId_date_idx" ON "daily_menus"("monthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menus_messId_date_mealType_key" ON "daily_menus"("messId", "date", "mealType");

-- CreateIndex
CREATE INDEX "grocery_items_category_isActive_idx" ON "grocery_items"("category", "isActive");

-- CreateIndex
CREATE INDEX "grocery_items_messId_idx" ON "grocery_items"("messId");

-- CreateIndex
CREATE INDEX "grocery_prices_messId_groceryItemId_observedOn_idx" ON "grocery_prices"("messId", "groceryItemId", "observedOn");

-- CreateIndex
CREATE INDEX "deposits_messId_monthId_status_idx" ON "deposits"("messId", "monthId", "status");

-- CreateIndex
CREATE INDEX "deposits_memberId_idx" ON "deposits"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_reversalOfId_key" ON "expenses"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_bazarEntryId_key" ON "expenses"("bazarEntryId");

-- CreateIndex
CREATE INDEX "expenses_messId_monthId_status_category_idx" ON "expenses"("messId", "monthId", "status", "category");

-- CreateIndex
CREATE INDEX "expenses_monthId_idx" ON "expenses"("monthId");

-- CreateIndex
CREATE INDEX "expense_allocations_memberId_idx" ON "expense_allocations"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_allocations_expenseId_memberId_key" ON "expense_allocations"("expenseId", "memberId");

-- CreateIndex
CREATE INDEX "member_adjustments_messId_monthId_idx" ON "member_adjustments"("messId", "monthId");

-- CreateIndex
CREATE INDEX "member_adjustments_memberId_idx" ON "member_adjustments"("memberId");

-- CreateIndex
CREATE INDEX "bazar_entries_messId_monthId_status_idx" ON "bazar_entries"("messId", "monthId", "status");

-- CreateIndex
CREATE INDEX "bazar_entries_buyerMemberId_idx" ON "bazar_entries"("buyerMemberId");

-- CreateIndex
CREATE INDEX "bazar_entry_items_bazarEntryId_idx" ON "bazar_entry_items"("bazarEntryId");

-- CreateIndex
CREATE INDEX "bazar_entry_items_groceryItemId_idx" ON "bazar_entry_items"("groceryItemId");

-- CreateIndex
CREATE INDEX "bazar_duties_monthId_date_idx" ON "bazar_duties"("monthId", "date");

-- CreateIndex
CREATE INDEX "bazar_duties_assigneeMemberId_idx" ON "bazar_duties"("assigneeMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "bazar_duties_messId_date_key" ON "bazar_duties"("messId", "date");

-- CreateIndex
CREATE INDEX "media_messId_kind_idx" ON "media"("messId", "kind");

-- CreateIndex
CREATE INDEX "media_bazarEntryId_idx" ON "media"("bazarEntryId");

-- CreateIndex
CREATE INDEX "ai_extractions_messId_status_idx" ON "ai_extractions"("messId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_messId_entityType_entityId_idx" ON "audit_logs"("messId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messes" ADD CONSTRAINT "messes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_invitations" ADD CONSTRAINT "mess_invitations_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_months" ADD CONSTRAINT "mess_months_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_type_settings" ADD CONSTRAINT "meal_type_settings_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_prices" ADD CONSTRAINT "grocery_prices_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_prices" ADD CONSTRAINT "grocery_prices_groceryItemId_fkey" FOREIGN KEY ("groceryItemId") REFERENCES "grocery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bazarEntryId_fkey" FOREIGN KEY ("bazarEntryId") REFERENCES "bazar_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_adjustments" ADD CONSTRAINT "member_adjustments_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_adjustments" ADD CONSTRAINT "member_adjustments_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_adjustments" ADD CONSTRAINT "member_adjustments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_entries" ADD CONSTRAINT "bazar_entries_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_entries" ADD CONSTRAINT "bazar_entries_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_entries" ADD CONSTRAINT "bazar_entries_buyerMemberId_fkey" FOREIGN KEY ("buyerMemberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_entry_items" ADD CONSTRAINT "bazar_entry_items_bazarEntryId_fkey" FOREIGN KEY ("bazarEntryId") REFERENCES "bazar_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_entry_items" ADD CONSTRAINT "bazar_entry_items_groceryItemId_fkey" FOREIGN KEY ("groceryItemId") REFERENCES "grocery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_duties" ADD CONSTRAINT "bazar_duties_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_duties" ADD CONSTRAINT "bazar_duties_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazar_duties" ADD CONSTRAINT "bazar_duties_assigneeMemberId_fkey" FOREIGN KEY ("assigneeMemberId") REFERENCES "mess_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_bazarEntryId_fkey" FOREIGN KEY ("bazarEntryId") REFERENCES "bazar_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_bazarEntryId_fkey" FOREIGN KEY ("bazarEntryId") REFERENCES "bazar_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
