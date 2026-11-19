import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";

import { auth } from "../../modules/auth/auth.ts";
import { db } from "../db/prisma.ts";
import { AppError } from "../utils/app-error.ts";

/** Requires a valid Better-Auth session; attaches it to `req.auth`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .then(async (session) => {
      if (!session?.user) {
        next(AppError.unauthorized());
        return;
      }
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { blockedAt: true },
      });
      if (!user) {
        next(AppError.unauthorized());
        return;
      }
      if (user.blockedAt) {
        next(AppError.forbidden("This account is blocked"));
        return;
      }
      req.auth = {
        user: session.user,
        session: { id: session.session.id, expiresAt: session.session.expiresAt },
      };
      next();
    })
    .catch(next);
};

/** Attaches the session when present but never rejects the request. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session) => {
      if (session?.user) {
        req.auth = {
          user: session.user,
          session: { id: session.session.id, expiresAt: session.session.expiresAt },
        };
      }
      next();
    })
    .catch(next);
};
