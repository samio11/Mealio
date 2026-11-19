import { z } from "zod";

import { zId } from "../../app/utils/zod-helpers.ts";

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminUserParamSchema = z.object({ userId: zId });
export const adminMessParamSchema = z.object({ messId: zId });
export const updatePlatformRoleSchema = z.object({ platformRole: z.enum(["USER", "ADMIN"]) });
export const setAdminUserBlockedSchema = z.object({ blocked: z.boolean() });
export const deleteAdminUserSchema = z.object({
  confirmationEmail: z.string().trim().email().max(254),
});
export const deleteMessSchema = z.object({
  confirmationName: z.string().trim().min(1).max(120),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
