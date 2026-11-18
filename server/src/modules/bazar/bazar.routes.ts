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
  bazarEntryParamSchema,
  createBazarEntrySchema,
  listBazarEntriesQuerySchema,
  rejectBazarEntrySchema,
  updateBazarEntrySchema,
} from "./bazar.schema.ts";
import {
  approveBazarEntry,
  createBazarEntry,
  deleteBazarEntry,
  getBazarEntry,
  listBazarEntries,
  rejectBazarEntry,
  submitBazarEntry,
  updateBazarEntry,
} from "./bazar.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/bazar-entries`. */
export const bazarRouter: Router = Router({ mergeParams: true });

bazarRouter.use(requireAuth);

bazarRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listBazarEntriesQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listBazarEntries(
      req.auth!.messId!,
      req.listQuery as never,
      req.auth!.membership!.id,
    );
    return paginated(res, items, meta);
  }),
);

bazarRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createBazarEntrySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    created(
      res,
      await createBazarEntry(req.auth!.messId!, req.body, {
        actorUserId: req.auth!.user.id,
        actorMembershipId: req.auth!.membership!.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

bazarRouter.get(
  "/:entryId",
  validate({ params: bazarEntryParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await getBazarEntry(req.auth!.messId!, req.params.entryId as string))),
);

bazarRouter.patch(
  "/:entryId",
  validate({ params: bazarEntryParamSchema, body: updateBazarEntrySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateBazarEntry(req.auth!.messId!, req.params.entryId as string, req.body, {
        actorUserId: req.auth!.user.id,
        actorMembershipId: req.auth!.membership!.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

bazarRouter.post(
  "/:entryId/submit",
  validate({ params: bazarEntryParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await submitBazarEntry(req.auth!.messId!, req.params.entryId as string, {
        actorUserId: req.auth!.user.id,
        actorMembershipId: req.auth!.membership!.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

bazarRouter.post(
  "/:entryId/approve",
  validate({ params: bazarEntryParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await approveBazarEntry(req.auth!.messId!, req.params.entryId as string, req.auth!.user.id, requestContext(req))),
  ),
);

bazarRouter.post(
  "/:entryId/reject",
  validate({ params: bazarEntryParamSchema, body: rejectBazarEntrySchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rejectBazarEntry(req.auth!.messId!, req.params.entryId as string, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);

bazarRouter.delete(
  "/:entryId",
  validate({ params: bazarEntryParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteBazarEntry(req.auth!.messId!, req.params.entryId as string, {
        actorUserId: req.auth!.user.id,
        actorMembershipId: req.auth!.membership!.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);
