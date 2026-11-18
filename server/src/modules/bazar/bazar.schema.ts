import { z } from "zod";

import { zDateOnly, zListQuery, zMonth, zQuantity, zTaka, zUnit, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

const paymentMethod = z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "OTHER"]);

export const bazarEntryParamSchema = z.object({
  messId: zUuid,
  entryId: zUuid,
});

export const bazarItemSchema = z
  .object({
    groceryItemId: zUuid.optional(),
    nameSnapshot: z.string().trim().min(1).max(120).optional(),
    nameBnSnapshot: z.string().trim().max(120).optional(),
    unit: zUnit,
    quantity: zQuantity,
    unitPriceTaka: zTaka,
    /** Optional AI confidence for this line (0-1). */
    confidence: z.number().min(0).max(1).optional(),
    source: z.enum(["MANAGER_ENTRY", "VERIFIED_PURCHASE", "ADMIN_REFERENCE", "RETAILER_FEED", "AI_ESTIMATE"]).optional(),
  })
  .refine((value) => Boolean(value.groceryItemId || value.nameSnapshot), {
    message: "Provide a catalogue item or an item name",
    path: ["nameSnapshot"],
  });

export const createBazarEntrySchema = z
  .object({
    monthId: zUuid.optional(),
    year: zYear.optional(),
    month: zMonth.optional(),
    buyerMemberId: zUuid.optional(),
    purchaseDate: zDateOnly,
    shopName: z.string().trim().max(120).nullable().optional(),
    paymentMethod: paymentMethod.default("CASH"),
    notes: z.string().trim().max(500).nullable().optional(),
    items: z.array(bazarItemSchema).min(1, "At least one item is required").max(100),
    /** Submit for review immediately instead of saving as a draft. */
    submit: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.monthId) || (value.year !== undefined && value.month !== undefined), {
    message: "Provide a monthId or both year and month",
    path: ["monthId"],
  });

export const updateBazarEntrySchema = z
  .object({
    purchaseDate: zDateOnly.optional(),
    shopName: z.string().trim().max(120).nullable().optional(),
    paymentMethod: paymentMethod.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    items: z.array(bazarItemSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const listBazarEntriesQuerySchema = zListQuery.extend({
  status: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
  buyerMemberId: zUuid.optional(),
  mine: z.coerce.boolean().optional(),
});

export const rejectBazarEntrySchema = z.object({
  reason: z.string().trim().min(2, "A reason is required").max(300),
});

export type BazarItemInput = z.infer<typeof bazarItemSchema>;
export type CreateBazarEntryInput = z.infer<typeof createBazarEntrySchema>;
export type UpdateBazarEntryInput = z.infer<typeof updateBazarEntrySchema>;
export type ListBazarEntriesQuery = z.infer<typeof listBazarEntriesQuerySchema>;
export type RejectBazarEntryInput = z.infer<typeof rejectBazarEntrySchema>;
