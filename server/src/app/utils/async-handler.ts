import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 * Express 5 forwards rejected promises automatically, but being explicit keeps
 * behaviour stable across versions.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
