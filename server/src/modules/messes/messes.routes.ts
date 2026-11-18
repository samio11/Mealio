import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { listMyMesses } from "../users/users.service.ts";
import { createMessSchema, messIdParamSchema, updateMessSchema } from "./messes.schema.ts";
import { createMess, getMess, updateMess } from "./messes.service.ts";

export const messesRouter: Router = Router();

messesRouter.use(requireAuth);

/** All messes the caller belongs to. */
messesRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await listMyMesses(req.auth!.user.id))),
);

messesRouter.post(
  "/",
  validate({ body: createMessSchema }),
  asyncHandler(async (req, res) => {
    const mess = await createMess(req.auth!.user.id, req.body, requestContext(req));
    return created(res, mess);
  }),
);

messesRouter.get(
  "/:messId",
  validate({ params: messIdParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const membership = req.auth!.membership!;
    return ok(res, await getMess(membership.messId, membership.role, req.auth!.user.id));
  }),
);

messesRouter.patch(
  "/:messId",
  validate({ params: messIdParamSchema, body: updateMessSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) => {
    const mess = await updateMess(req.auth!.membership!.messId, req.body, req.auth!.user.id, requestContext(req));
    return ok(res, mess);
  }),
);
