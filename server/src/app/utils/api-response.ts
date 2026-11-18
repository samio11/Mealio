import type { Response } from "express";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, statusCode = 200, meta?: Record<string, unknown>) {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return ok(res, data, 201, meta);
}

export function paginated<T>(
  res: Response,
  items: T[],
  pagination: PaginationMeta,
  extraMeta?: Record<string, unknown>,
) {
  return ok(res, items, 200, { ...pagination, ...extraMeta });
}

export function fail(res: Response, statusCode: number, code: string, message: string, details?: unknown) {
  const body: ApiFailure = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(statusCode).json(body);
}
