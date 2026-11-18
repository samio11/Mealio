import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok, paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  createDepositSchema,
  depositParamSchema,
  listDepositsQuerySchema,
  rejectDepositSchema,
} from "./deposits.schema.ts";
import {
  createDeposit,
  deletePendingDeposit,
  getDeposit,
  listDeposits,
  rejectDeposit,
  verifyDeposit,
} from "./deposits.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/deposits`. */
export const depositsRouter: Router = Router({ mergeParams: true });

depositsRouter.use(requireAuth);

depositsRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listDepositsQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listDeposits(req.auth!.messId!, req.listQuery as never);
    return paginated(res, items, meta);
  }),
);

depositsRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createDepositSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    created(
      res,
      await createDeposit(req.auth!.messId!, req.body, {
        actorUserId: req.auth!.user.id,
        actorMembershipId: req.auth!.membership!.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

depositsRouter.get(
  "/:depositId",
  validate({ params: depositParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getDeposit(req.auth!.messId!, req.params.depositId as string)),
  ),
);

depositsRouter.post(
  "/:depositId/verify",
  validate({ params: depositParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await verifyDeposit(req.auth!.messId!, req.params.depositId as string, req.auth!.user.id, requestContext(req)),
    ),
  ),
);

depositsRouter.post(
  "/:depositId/reject",
  validate({ params: depositParamSchema, body: rejectDepositSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rejectDeposit(
        req.auth!.messId!,
        req.params.depositId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

depositsRouter.delete(
  "/:depositId",
  validate({ params: depositParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deletePendingDeposit(
        req.auth!.messId!,
        req.params.depositId as string,
        req.auth!.user.id,
        req.auth!.membership!.role,
        requestContext(req),
      ),
    ),
  ),
);
