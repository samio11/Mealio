import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { ok } from "../../app/utils/api-response.ts";
import { getProfile, listMyMesses, updateProfile } from "./users.service.ts";
import { updateMeSchema } from "./users.schema.ts";
import { createProfileImageUploadSignature } from "../media/media.service.ts";

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const profile = await getProfile(req.auth!.user.id);
    return ok(res, profile);
  }),
);

usersRouter.patch(
  "/me",
  validate({ body: updateMeSchema }),
  asyncHandler(async (req, res) => {
    const profile = await updateProfile(req.auth!.user.id, req.body);
    return ok(res, profile);
  }),
);

usersRouter.post(
  "/me/image-upload-sign",
  asyncHandler(async (req, res) => ok(res, createProfileImageUploadSignature(req.auth!.user.id))),
);

usersRouter.get(
  "/me/messes",
  asyncHandler(async (req, res) => {
    const messes = await listMyMesses(req.auth!.user.id);
    return ok(res, messes);
  }),
);
