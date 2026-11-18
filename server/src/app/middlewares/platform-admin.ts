import type { RequestHandler } from "express";

import { db } from "../db/prisma.ts";
import { AppError } from "../utils/app-error.ts";

/** Re-checks the current database role for every platform-admin request. */
export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.user.id;
  if (!userId) {
    next(AppError.unauthorized());
    return;
  }

  db.user
    .findUnique({ where: { id: userId }, select: { platformRole: true } })
    .then((user) => {
      if (user?.platformRole !== "ADMIN") {
        next(AppError.forbidden("Platform administrator access required"));
        return;
      }
      next();
    })
    .catch(next);
};
