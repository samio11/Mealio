import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  confirmUploadSchema,
  listMediaQuerySchema,
  mediaIdParamSchema,
  signUploadSchema,
  signedUrlQuerySchema,
} from "./media.schema.ts";
import { confirmUpload, createUploadSignature, deleteMedia, getSignedUrl, listMedia } from "./media.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/media`. */
export const mediaRouter: Router = Router({ mergeParams: true });

mediaRouter.use(requireAuth);

/** Step 1: obtain a signature for a direct-to-storage upload. */
mediaRouter.post(
  "/sign",
  validate({ params: messIdParamOnlySchema, body: signUploadSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, createUploadSignature(req.auth!.messId!))),
);

/** Step 2: after the client uploads, persist the media record. */
mediaRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: confirmUploadSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    created(res, await confirmUpload(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

mediaRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listMediaQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await listMedia(req.auth!.messId!, req.listQuery as never))),
);

/** Expiring signed URL — the only way to read a private asset. */
mediaRouter.get(
  "/:mediaId/url",
  validate({ params: mediaIdParamSchema, query: signedUrlQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const ttl = (req.listQuery as { ttl?: number }).ttl;
    return ok(res, await getSignedUrl(req.auth!.messId!, req.params.mediaId as string, ttl));
  }),
);

mediaRouter.delete(
  "/:mediaId",
  validate({ params: mediaIdParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await deleteMedia(req.auth!.messId!, req.params.mediaId as string, req.auth!.user.id, requestContext(req))),
  ),
);
