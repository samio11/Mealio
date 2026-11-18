import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { isProd } from "../config/env.ts";
import { ErrorCode, AppError } from "../utils/app-error.ts";
import { fail } from "../utils/api-response.ts";
import { logger } from "../utils/logger.ts";

interface MaybeHttpError {
  status?: number;
  statusCode?: number;
  code?: string;
  message?: string;
  type?: string;
  name?: string;
}

function isBodySyntaxError(err: unknown): err is MaybeHttpError {
  const e = err as MaybeHttpError;
  return e?.type === "entity.parse.failed" || (e?.name === "SyntaxError" && e?.status === 400);
}

/** Central error handler: the ONLY place that formats error responses. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, path: req.path }, "request failed");
    else logger.debug({ code: err.code, path: req.path }, "request rejected");
    fail(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    fail(res, 400, ErrorCode.VALIDATION_ERROR, "Invalid request input", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (isBodySyntaxError(err)) {
    fail(res, 400, ErrorCode.VALIDATION_ERROR, "Malformed JSON body");
    return;
  }

  // Prisma known-request errors (duck-typed to avoid a hard dependency here).
  const code = (err as MaybeHttpError)?.code;
  if (typeof code === "string" && code.startsWith("P")) {
    if (code === "P2002") {
      fail(res, 409, ErrorCode.CONFLICT, "A record with these values already exists");
      return;
    }
    if (code === "P2025") {
      fail(res, 404, ErrorCode.NOT_FOUND, "Resource not found");
      return;
    }
    if (code === "P2003") {
      fail(res, 409, ErrorCode.CONFLICT, "Operation violates a related record constraint");
      return;
    }
  }

  logger.error({ err, path: req.path }, "unhandled error");
  fail(
    res,
    500,
    ErrorCode.INTERNAL_ERROR,
    isProd ? "Something went wrong" : String((err as Error)?.message ?? err),
  );
};
