import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import {
  listMembersQuerySchema,
  messMemberParamSchema,
  updateMembershipSchema,
} from "./memberships.schema.ts";
import { getMember, listMembers, removeMember, updateMember } from "./memberships.service.ts";

/** Mounted at `/api/v1/messes/:messId/members` — mergeParams exposes :messId. */
export const membershipsRouter: Router = Router({ mergeParams: true });

membershipsRouter.use(requireAuth);

membershipsRouter.get(
  "/",
  validate({ params: messMemberParamSchema.pick({ messId: true }), query: listMembersQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await listMembers(req.auth!.messId!, req.listQuery as never, req.auth!.membership!.role)),
  ),
);

membershipsRouter.get(
  "/:memberId",
  validate({ params: messMemberParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getMember(req.auth!.messId!, req.params.memberId as string, req.auth!.membership!.role)),
  ),
);

membershipsRouter.patch(
  "/:memberId",
  validate({ params: messMemberParamSchema, body: updateMembershipSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateMember(req.auth!.messId!, req.params.memberId as string, req.body, {
        actorUserId: req.auth!.user.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

membershipsRouter.delete(
  "/me",
  validate({ params: messMemberParamSchema.pick({ messId: true }) }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await removeMember(req.auth!.messId!, req.auth!.membership!.id, {
        actorUserId: req.auth!.user.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);

membershipsRouter.delete(
  "/:memberId",
  validate({ params: messMemberParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await removeMember(req.auth!.messId!, req.params.memberId as string, {
        actorUserId: req.auth!.user.id,
        actorRole: req.auth!.membership!.role,
        ctx: requestContext(req),
      }),
    ),
  ),
);
