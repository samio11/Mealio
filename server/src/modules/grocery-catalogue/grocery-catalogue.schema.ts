import { z } from "zod";

import { zListQuery, zUnit, zUuid } from "../../app/utils/zod-helpers.ts";

export const groceryItemIdParamSchema = z.object({
  messId: zUuid,
  itemId: zUuid,
});

export const listCatalogueQuerySchema = zListQuery.extend({
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  includeInactive: z.coerce.boolean().optional(),
  /** Only return items created by this mess (excludes the global catalogue). */
  customOnly: z.coerce.boolean().optional(),
});

export const createGroceryItemSchema = z.object({
  nameEn: z.string().trim().min(1, "English name is required").max(120),
  nameBn: z.string().trim().min(1, "Bangla name is required").max(120),
  aliases: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  category: z.string().trim().min(1, "Category is required").max(80),
  unit: zUnit.default("KG"),
  brand: z.string().trim().max(80).nullable().optional(),
});

export const updateGroceryItemSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(120).optional(),
    nameBn: z.string().trim().min(1).max(120).optional(),
    aliases: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    unit: zUnit.optional(),
    brand: z.string().trim().max(80).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type ListCatalogueQuery = z.infer<typeof listCatalogueQuerySchema>;
export type CreateGroceryItemInput = z.infer<typeof createGroceryItemSchema>;
export type UpdateGroceryItemInput = z.infer<typeof updateGroceryItemSchema>;
