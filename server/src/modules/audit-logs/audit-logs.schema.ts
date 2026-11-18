import { z } from "zod";

import { zDateOnly, zUuid } from "../../app/utils/zod-helpers.ts";

export const listAuditLogsQuerySchema = z.object({
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
  actorUserId: zUuid.optional(),
  action: z.string().trim().max(80).optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
