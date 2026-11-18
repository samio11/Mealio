import { z } from "zod";

import { zTaka, zTimeHHMM, zUuid, zYear, zMonth } from "../../app/utils/zod-helpers.ts";

export const monthParamSchema = z.object({
  messId: zUuid,
  monthId: zUuid,
});

export const mealSettingParamSchema = z.object({
  messId: zUuid,
  monthId: zUuid,
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER"]),
});

export const listMonthsQuerySchema = z.object({
  year: zYear.optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});

export const createMonthSchema = z.object({
  year: zYear,
  month: zMonth,
  openingCashTaka: zTaka.default(0n),
  budgetTaka: zTaka.default(0n),
  mealRatePolicy: z.enum(["EXPENSES_OVER_MEALS"]).default("EXPENSES_OVER_MEALS"),
  mealSettings: z
    .array(
      z.object({
        mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER"]),
        enabled: z.boolean().default(true),
        cutoff: zTimeHHMM.optional(),
      }).strict(),
    )
    .optional(),
});

export const updateMonthSchema = z
  .object({
    openingCashTaka: zTaka.optional(),
    budgetTaka: zTaka.optional(),
    mealRatePolicy: z.enum(["EXPENSES_OVER_MEALS"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const updateMealSettingSchema = z
  .object({
    enabled: z.boolean().optional(),
    cutoff: zTimeHHMM.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type ListMonthsQuery = z.infer<typeof listMonthsQuerySchema>;
export type CreateMonthInput = z.infer<typeof createMonthSchema>;
export type UpdateMonthInput = z.infer<typeof updateMonthSchema>;
export type UpdateMealSettingInput = z.infer<typeof updateMealSettingSchema>;
