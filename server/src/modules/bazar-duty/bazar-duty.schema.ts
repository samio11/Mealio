import { z } from "zod";

import { zDateOnly, zMonth, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

export const dutyParamSchema = z.object({
  messId: zUuid,
  dutyId: zUuid,
});

export const listDutiesQuerySchema = z.object({
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "SKIPPED"]).optional(),
});

export const generateDutiesSchema = z.object({
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
  /** Restrict assignments to these dates; defaults to every day of the month. */
  dates: z.array(zDateOnly).min(1).max(31).optional(),
  /** Restrict the eligible pool; defaults to all duty-eligible active members. */
  eligibleMemberIds: z.array(zUuid).min(1).optional(),
  /** Preserve existing manual overrides even for future dates. Defaults to true. */
  preserveOverrides: z.boolean().default(true),
});

export const assignDutySchema = z.object({
  assigneeMemberId: zUuid.nullable(),
  reason: z.string().trim().min(2, "A reason is required for a manual override").max(300),
});

export const updateDutyStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "SKIPPED"]),
  reason: z.string().trim().max(300).optional(),
});

export const swapDutiesSchema = z.object({
  fromDutyId: zUuid,
  toDutyId: zUuid,
  reason: z.string().trim().max(300).optional(),
});

export type ListDutiesQuery = z.infer<typeof listDutiesQuerySchema>;
export type GenerateDutiesInput = z.infer<typeof generateDutiesSchema>;
export type AssignDutyInput = z.infer<typeof assignDutySchema>;
export type UpdateDutyStatusInput = z.infer<typeof updateDutyStatusSchema>;
export type SwapDutiesInput = z.infer<typeof swapDutiesSchema>;
