import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import {
  createInvitationSchema,
  invitationIdParamSchema,
  invitationTokenParamSchema,
  listInvitationsQuerySchema,
  messIdParamOnlySchema,
} from "./invitations.schema.ts";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  revokeInvitation,
} from "./invitations.service.ts";

/** Mounted at `/api/v1/messes/:messId/invitations` — manager only. */
export const messInvitationsRouter: Router = Router({ mergeParams: true });

messInvitationsRouter.use(requireAuth, requireMessAccess({ manager: true }));

messInvitationsRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listInvitationsQuerySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await listInvitations(req.auth!.messId!, req.listQuery as never)),
  ),
);

messInvitationsRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createInvitationSchema }),
  asyncHandler(async (req, res) =>
    created(res, await createInvitation(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

messInvitationsRouter.delete(
  "/:invitationId",
  validate({ params: invitationIdParamSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await revokeInvitation(
        req.auth!.messId!,
        req.params.invitationId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);

/** Mounted at `/api/v1/invitations` — any signed-in user may preview/accept. */
export const invitationsRouter: Router = Router();

invitationsRouter.use(requireAuth);

invitationsRouter.get(
  "/:token",
  validate({ params: invitationTokenParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await previewInvitation(req.params.token as string, req.auth!.user.id)),
  ),
);

invitationsRouter.post(
  "/:token/accept",
  validate({ params: invitationTokenParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await acceptInvitation(req.params.token as string, req.auth!.user.id, requestContext(req))),
  ),
);
