import { z } from "zod";

import { zDateOnly, zListQuery, zMonth, zTaka, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

export const expenseParamSchema = z.object({
  messId: zUuid,
  expenseId: zUuid,
});

export const listExpensesQuerySchema = zListQuery.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVERSED"]).optional(),
  category: z
    .enum([
      "MEAL_BAZAR",
      "RENT",
      "ELECTRICITY",
      "GAS",
      "WIFI",
      "CLEANING",
      "OTHER_SHARED",
      "MEMBER_SPECIFIC",
      "REFUND_ADJUSTMENT",
    ])
    .optional(),
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
});

const allocationMethod = z.enum(["EQUAL", "MEAL_COUNT", "CUSTOM"]);

export const createExpenseSchema = z
  .object({
    monthId: zUuid.optional(),
    year: zYear.optional(),
    month: zMonth.optional(),
    category: z.enum([
      "MEAL_BAZAR",
      "RENT",
      "ELECTRICITY",
      "GAS",
      "WIFI",
      "CLEANING",
      "OTHER_SHARED",
      "MEMBER_SPECIFIC",
      "REFUND_ADJUSTMENT",
    ]),
    amountTaka: zTaka,
    description: z.string().trim().min(2, "A description is required").max(200),
    allocationMethod: allocationMethod.default("EQUAL"),
    incurredOn: zDateOnly,
    note: z.string().trim().max(300).nullable().optional(),
    /** Required when allocationMethod is CUSTOM. */
    allocations: z
      .array(
        z.object({
          memberId: zUuid,
          amountTaka: zTaka,
        }),
      )
      .optional(),
  })
  .refine((value) => Boolean(value.monthId) || (value.year !== undefined && value.month !== undefined), {
    message: "Provide a monthId or both year and month",
    path: ["monthId"],
  })
  .refine((value) => value.allocationMethod !== "CUSTOM" || (value.allocations?.length ?? 0) > 0, {
    message: "Custom allocation requires at least one allocation entry",
    path: ["allocations"],
  });

export const rejectExpenseSchema = z.object({
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export const reverseExpenseSchema = z.object({
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type ReverseExpenseInput = z.infer<typeof reverseExpenseSchema>;
