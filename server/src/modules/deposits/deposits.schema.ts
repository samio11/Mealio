import { z } from "zod";

import { zListQuery, zMonth, zTaka, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

export const depositParamSchema = z.object({
  messId: zUuid,
  depositId: zUuid,
});

export const listDepositsQuerySchema = zListQuery.extend({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  memberId: zUuid.optional(),
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
});

const paymentMethod = z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "OTHER"]);

export const createDepositSchema = z
  .object({
    /** Defaults to the caller's own membership. Managers may target any member. */
    memberId: zUuid.optional(),
    monthId: zUuid.optional(),
    year: zYear.optional(),
    month: zMonth.optional(),
    amountTaka: zTaka,
    method: paymentMethod.default("CASH"),
    reference: z.string().trim().max(120).nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
  })
  .refine((value) => Boolean(value.monthId) || (value.year !== undefined && value.month !== undefined), {
    message: "Provide a monthId or both year and month",
    path: ["monthId"],
  });

export const rejectDepositSchema = z.object({
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export type ListDepositsQuery = z.infer<typeof listDepositsQuerySchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type RejectDepositInput = z.infer<typeof rejectDepositSchema>;
