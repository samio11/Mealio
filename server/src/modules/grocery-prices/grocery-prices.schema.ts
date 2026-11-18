import { z } from "zod";

import { zDateOnly, zListQuery, zTaka, zUnit, zUuid } from "../../app/utils/zod-helpers.ts";

export const priceIdParamSchema = z.object({
  messId: zUuid,
  priceId: zUuid,
});

export const listPricesQuerySchema = zListQuery.extend({
  groceryItemId: zUuid.optional(),
  source: z.enum(["MANAGER_ENTRY", "VERIFIED_PURCHASE", "ADMIN_REFERENCE", "RETAILER_FEED", "AI_ESTIMATE"]).optional(),
  verification: z.enum(["UNVERIFIED", "VERIFIED", "OUTDATED"]).optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
});

export const createPriceSchema = z.object({
  groceryItemId: zUuid,
  priceTaka: zTaka,
  unit: zUnit,
  source: z.enum(["MANAGER_ENTRY", "VERIFIED_PURCHASE", "ADMIN_REFERENCE", "RETAILER_FEED", "AI_ESTIMATE"]).default("MANAGER_ENTRY"),
  shopName: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  observedOn: zDateOnly,
});

export const updatePriceSchema = z
  .object({
    priceTaka: zTaka.optional(),
    unit: zUnit.optional(),
    verification: z.enum(["UNVERIFIED", "VERIFIED", "OUTDATED"]).optional(),
    shopName: z.string().trim().max(120).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    observedOn: zDateOnly.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type ListPricesQuery = z.infer<typeof listPricesQuerySchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
