import { z } from "zod";

import { zDateOnly, zListQuery, zMonth, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

const mealTypeEnum = z.enum(["BREAKFAST", "LUNCH", "DINNER"]);
const mealStatusEnum = z.enum(["ON", "OFF"]);

export const mealRecordParamSchema = z.object({
  messId: zUuid,
  recordId: zUuid,
});

export const listMealRecordsQuerySchema = zListQuery.extend({
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
  memberId: zUuid.optional(),
  date: zDateOnly.optional(),
  mealType: mealTypeEnum.optional(),
});

export const setMealRecordSchema = z.object({
  date: zDateOnly,
  mealType: mealTypeEnum,
  status: mealStatusEnum,
});

export const overrideMealRecordSchema = z.object({
  memberId: zUuid,
  date: zDateOnly,
  mealType: mealTypeEnum,
  status: mealStatusEnum,
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export const bulkMealRecordSchema = z.object({
  memberIds: z.array(zUuid).min(1).max(100),
  date: zDateOnly,
  mealType: mealTypeEnum,
  status: mealStatusEnum,
  reason: z.string().trim().max(300).optional(),
});

export const guestMealSchema = z.object({
  memberId: zUuid,
  date: zDateOnly,
  mealType: mealTypeEnum,
  guestCount: z.coerce.number().int().min(0).max(50),
  reason: z.string().trim().max(300).optional(),
});

const monthMealRecordSchema = z.object({
  date: zDateOnly,
  mealType: mealTypeEnum,
  status: mealStatusEnum,
});

export const monthMealOverrideSchema = z
  .object({
    monthId: zUuid,
    memberId: zUuid,
    records: z.array(monthMealRecordSchema).min(1).max(93),
    reason: z.string().trim().min(2, "A reason is required").max(300),
  })
  .refine(
    ({ records }) => new Set(records.map((record) => `${record.date}:${record.mealType}`)).size === records.length,
    { message: "Each date and meal may only be updated once", path: ["records"] },
  );

/** Menus */
export const listMenusQuerySchema = z.object({
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  mealType: mealTypeEnum.optional(),
});

export const upsertMenuSchema = z.object({
  monthId: zUuid.optional(),
  date: zDateOnly,
  mealType: mealTypeEnum,
  menuText: z.string().trim().min(1, "Menu text is required").max(1000),
  noticeText: z.string().trim().max(500).nullable().optional(),
});

export const menuParamSchema = z.object({
  messId: zUuid,
  menuId: zUuid,
});

export type ListMealRecordsQuery = z.infer<typeof listMealRecordsQuerySchema>;
export type SetMealRecordInput = z.infer<typeof setMealRecordSchema>;
export type OverrideMealRecordInput = z.infer<typeof overrideMealRecordSchema>;
export type BulkMealRecordInput = z.infer<typeof bulkMealRecordSchema>;
export type GuestMealInput = z.infer<typeof guestMealSchema>;
export type MonthMealOverrideInput = z.infer<typeof monthMealOverrideSchema>;
export type ListMenusQuery = z.infer<typeof listMenusQuerySchema>;
export type UpsertMenuInput = z.infer<typeof upsertMenuSchema>;
