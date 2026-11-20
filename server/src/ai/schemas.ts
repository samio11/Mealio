import { z } from "zod";

import { zUnit } from "../app/utils/zod-helpers.ts";

/**
 * All AI output is UNTRUSTED and validated with Zod before it touches the
 * application. These schemas are the contract the providers must satisfy.
 */

/** One grocery line the model believes it saw on a receipt / bazar photo. */
export const aiBazarItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  nameBn: z.string().trim().max(160).optional(),
  quantity: z.coerce.number().positive().max(100_000),
  unit: zUnit.default("KG"),
  /** Total price (in Taka) paid for this line item, as shown on the receipt. */
  totalPriceTaka: z.coerce.number().nonnegative().max(10_000_000).optional(),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  notes: z.string().trim().max(300).optional(),
});

export const aiBazarExtractionSchema = z.object({
  shopName: z.string().trim().max(160).optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  totalTaka: z.coerce.number().nonnegative().max(100_000_000).optional(),
  overallConfidence: z.coerce.number().min(0).max(1).default(0.5),
  items: z.array(aiBazarItemSchema).max(80).default([]),
});

export const aiPriceEstimateSchema = z.object({
  priceTaka: z.coerce.number().positive().max(10_000_000),
  lowTaka: z.coerce.number().nonnegative().max(10_000_000).optional(),
  highTaka: z.coerce.number().nonnegative().max(10_000_000).optional(),
  confidence: z.coerce.number().min(0).max(1).default(0.4),
  rationale: z.string().trim().max(600).optional(),
});

export const aiReportSummarySchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  highlights: z.array(z.string().trim().max(300)).max(12).default([]),
  concerns: z.array(z.string().trim().max(300)).max(12).default([]),
});

export type AiBazarItem = z.infer<typeof aiBazarItemSchema>;
export type AiBazarExtraction = z.infer<typeof aiBazarExtractionSchema>;
export type AiPriceEstimate = z.infer<typeof aiPriceEstimateSchema>;
export type AiReportSummary = z.infer<typeof aiReportSummarySchema>;
