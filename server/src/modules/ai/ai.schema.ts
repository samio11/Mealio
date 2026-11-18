import { z } from "zod";

import { zUnit, zUuid } from "../../app/utils/zod-helpers.ts";

export const extractBazarSchema = z
  .object({
    mediaIds: z.array(zUuid).max(6).optional(),
    imageUrls: z.array(z.string().url().max(2048)).max(6).optional(),
    bazarEntryId: zUuid.nullable().optional(),
  })
  .refine((value) => Boolean(value.mediaIds?.length || value.imageUrls?.length), {
    message: "Provide at least one mediaId or imageUrl",
    path: ["mediaIds"],
  });

export const priceEstimateSchema = z.object({
  groceryItemId: zUuid.optional(),
  nameEn: z.string().trim().min(1).max(160).optional(),
  nameBn: z.string().trim().max(160).optional(),
  unit: zUnit.optional(),
});

export const reportSummarySchema = z.object({
  monthId: zUuid,
});

export type ExtractBazarBody = z.infer<typeof extractBazarSchema>;
export type PriceEstimateBody = z.infer<typeof priceEstimateSchema>;
export type ReportSummaryBody = z.infer<typeof reportSummarySchema>;
