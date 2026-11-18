import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../utils/app-error.ts";

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function issuesOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}

/**
 * Validates and coerces request input.
 *
 * Note: Express 5 exposes `req.query` as a getter, so parsed query values are
 * written to `req.listQuery` instead of mutating `req.query`.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) throw AppError.badRequest("Invalid path parameters", issuesOf(result.error));
        req.params = result.data as typeof req.params;
      }
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) throw AppError.badRequest("Invalid query parameters", issuesOf(result.error));
        req.listQuery = result.data as Record<string, unknown>;
      }
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) throw AppError.badRequest("Invalid request body", issuesOf(result.error));
        req.body = result.data;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
