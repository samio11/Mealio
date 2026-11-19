import { z } from "zod";

import { zListQuery, zUuid } from "../../app/utils/zod-helpers.ts";

export const utilityCategories = ["ELECTRICITY", "GAS", "WATER", "MAID", "GARBAGE"] as const;

export const listUtilitiesQuerySchema = zListQuery.extend({
  monthId: zUuid.optional(),
});

export const utilityExpenseParamSchema = z.object({
  messId: zUuid,
  expenseId: zUuid,
});

export const utilityPaymentParamSchema = z.object({
  messId: zUuid,
  paymentId: zUuid,
});

export const submitUtilityPaymentSchema = z.object({
  method: z.enum(["CASH", "BKASH", "NAGAD", "CARD"]),
  reference: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

export const setUtilityBillPaidSchema = z.object({
  paid: z.boolean(),
});

export const rejectUtilityPaymentSchema = z.object({
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export type ListUtilitiesQuery = z.infer<typeof listUtilitiesQuerySchema>;
export type SubmitUtilityPaymentInput = z.infer<typeof submitUtilityPaymentSchema>;
export type SetUtilityBillPaidInput = z.infer<typeof setUtilityBillPaidSchema>;
export type RejectUtilityPaymentInput = z.infer<typeof rejectUtilityPaymentSchema>;
