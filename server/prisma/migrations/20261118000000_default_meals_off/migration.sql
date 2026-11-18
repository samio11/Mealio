-- Meal counts now start at zero and grow from explicit ON records.
ALTER TABLE "meal_type_settings"
ALTER COLUMN "defaultOn" SET DEFAULT false;

UPDATE "meal_type_settings" AS setting
SET "defaultOn" = false
FROM "mess_months" AS month
WHERE setting."monthId" = month.id
  AND month.status = 'OPEN';
