import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import { listAuditLogsQuerySchema } from "./audit-logs.schema.ts";
import { listAuditLogs } from "./audit-logs.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/audit-logs` (managers only). */
export const auditLogsRouter: Router = Router({ mergeParams: true });

auditLogsRouter.use(requireAuth);

auditLogsRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listAuditLogsQuerySchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAuditLogs(req.auth!.messId!, req.listQuery as never);
    return paginated(res, items, meta);
  }),
);
