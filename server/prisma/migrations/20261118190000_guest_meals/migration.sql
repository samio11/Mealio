CREATE TABLE "guest_meal_records" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_meal_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_meal_records_messId_memberId_date_mealType_key"
ON "guest_meal_records"("messId", "memberId", "date", "mealType");

CREATE INDEX "guest_meal_records_monthId_date_idx"
ON "guest_meal_records"("monthId", "date");

ALTER TABLE "guest_meal_records"
ADD CONSTRAINT "guest_meal_records_messId_fkey"
FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_meal_records"
ADD CONSTRAINT "guest_meal_records_monthId_fkey"
FOREIGN KEY ("monthId") REFERENCES "mess_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_meal_records"
ADD CONSTRAINT "guest_meal_records_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "mess_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
