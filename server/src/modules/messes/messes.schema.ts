import { z } from "zod";

import { zUuid } from "../../app/utils/zod-helpers.ts";

export const createMessSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  area: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
});

export const updateMessSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    area: z.string().trim().max(120).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const messIdParamSchema = z.object({ messId: zUuid });

export type CreateMessInput = z.infer<typeof createMessSchema>;
export type UpdateMessInput = z.infer<typeof updateMessSchema>;
