import { z } from "zod";

import { zDateOnly, zListQuery, zTaka, zUnit, zUuid } from "../../app/utils/zod-helpers.ts";

export const adminGroceryMasterItemParamSchema = z.object({ itemId: zUuid });

export const adminGroceryMasterListQuerySchema = zListQuery.extend({
  q: z.string().trim().max(120).optional(),
});

export const updateGroceryMasterItemSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(120).optional(),
    nameBn: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    unit: zUnit.optional(),
    isActive: z.boolean().optional(),
    unitLabel: z.string().trim().min(1).max(40).optional(),
    minPriceTaka: zTaka.optional(),
    maxPriceTaka: zTaka.optional(),
    referencePriceTaka: zTaka.optional(),
    sourceNote: z.string().trim().min(1).max(300).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
    checkedOn: zDateOnly.optional(),
    priceType: z.string().trim().min(1).max(80).optional(),
    priceIsActive: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type AdminGroceryMasterListQuery = z.infer<typeof adminGroceryMasterListQuerySchema>;
export type UpdateGroceryMasterItemInput = z.infer<typeof updateGroceryMasterItemSchema>;
