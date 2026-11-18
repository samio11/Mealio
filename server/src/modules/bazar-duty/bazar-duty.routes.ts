import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  assignDutySchema,
  dutyParamSchema,
  generateDutiesSchema,
  listDutiesQuerySchema,
  swapDutiesSchema,
  updateDutyStatusSchema,
} from "./bazar-duty.schema.ts";
import { assignDuty, generateDuties, listDuties, swapDuties, updateDutyStatus } from "./bazar-duty.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/duties`. */
export const dutiesRouter: Router = Router({ mergeParams: true });

dutiesRouter.use(requireAuth);

dutiesRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listDutiesQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await listDuties(req.auth!.messId!, req.listQuery as never))),
);

/** Generates/regenerates the duty roster deterministically (manager only). */
dutiesRouter.post(
  "/generate",
  validate({ params: messIdParamOnlySchema, body: generateDutiesSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await generateDuties(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

/** Swap the assignees of two upcoming duty dates. */
dutiesRouter.post(
  "/swap",
  validate({ params: messIdParamOnlySchema, body: swapDutiesSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await swapDuties(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

/** Manual reassignment of a single duty (requires a reason). */
dutiesRouter.patch(
  "/:dutyId",
  validate({ params: dutyParamSchema, body: assignDutySchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await assignDuty(req.auth!.messId!, req.params.dutyId as string, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

/** Mark a duty completed or skipped. */
dutiesRouter.patch(
  "/:dutyId/status",
  validate({ params: dutyParamSchema, body: updateDutyStatusSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateDutyStatus(req.auth!.messId!, req.params.dutyId as string, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);
