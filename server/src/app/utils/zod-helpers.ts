import { z } from "zod";

import { takaToPoisha } from "./money.ts";
import { hhmmToMinutes } from "./date.ts";

export const zId = z.string().min(1, "Required");
export const zUuid = z.string().uuid("Must be a valid id");

/** Date-only string in Dhaka calendar form. */
export const zDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const zYear = z.coerce.number().int().min(2000).max(2200);
export const zMonth = z.coerce.number().int().min(1).max(12);

/** "HH:MM" 24-hour Dhaka local time. */
export const zTimeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Expected HH:MM (24-hour)")
  .transform((value) => hhmmToMinutes(value));

/** Bangladesh phone number in normalised international form. */
export const zBdPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => /^\+8801[3-9]\d{8}$/.test(value), "Expected +8801XXXXXXXXX");

/**
 * A taka amount accepted as string or number and converted to integer poisha.
 * Rejects non-finite values and anything with more than 2 meaningful decimals
 * is rounded half-up by {@link takaToPoisha}.
 */
export const zTaka = z
  .union([z.string().trim().min(1), z.number().finite()])
  .transform((value, ctx) => {
    try {
      return takaToPoisha(value);
    } catch {
      ctx.addIssue({ code: "custom", message: `Invalid taka amount: ${String(value)}` });
      return z.NEVER;
    }
  });

/** Grocery units supported by the catalogue (mirrors the Prisma `Unit` enum). */
export const zUnit = z.enum(["KG", "GRAM", "LITRE", "ML", "PIECE", "DOZEN", "PACKET", "BOTTLE"]);

/** Positive (or zero) quantity with up to 3 decimals. */
export const zQuantity = z
  .union([z.string().trim(), z.number().finite()])
  .transform((value) => (typeof value === "number" ? value.toString() : value))
  .refine((value) => /^\d+(\.\d{1,3})?$/.test(value), "Expected a positive quantity (max 3 decimals)");

export const zListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
