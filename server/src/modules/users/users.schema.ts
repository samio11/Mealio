import { z } from "zod";

import { zBdPhone, zId } from "../../app/utils/zod-helpers.ts";

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: zBdPhone.nullable().optional(),
  locale: z.enum(["bn", "en"]).optional(),
  image: z.string().url().max(2048).nullable().optional(),
});

export const userIdParamSchema = z.object({ userId: zId });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
