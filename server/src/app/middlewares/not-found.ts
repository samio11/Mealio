import type { RequestHandler } from "express";

import { ErrorCode } from "../utils/app-error.ts";
import { fail } from "../utils/api-response.ts";

export const notFoundHandler: RequestHandler = (req, res) => {
  fail(res, 404, ErrorCode.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`);
};
