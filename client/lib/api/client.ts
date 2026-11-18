/**
 * Typed fetch wrapper for the Express API.
 *
 * Every request is same-origin (`/api/*` is proxied by Next.js), so the
 * Better-Auth session cookie is sent automatically with `credentials: include`.
 * All money fields arrive as integer-poisha **strings** (the server serialises
 * BigInt that way) — never parse them into floats for arithmetic.
 */

export const API_BASE = "/api/v1";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta & Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 422 — a business-rule violation the user can usually act on. */
  get isBusinessRule(): boolean {
    return this.code === "BUSINESS_RULE_VIOLATION";
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR";
  }
}

export type QueryValue = string | number | boolean | null | undefined;

/** Serialises a query object, dropping empty values and expanding arrays. */
export function buildQuery(params?: Record<string, QueryValue | QueryValue[]>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined && entry !== null && entry !== "") search.append(key, String(entry));
      }
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
  /** Absolute or non-/api/v1 path (e.g. the CSV export). */
  rawPath?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = "GET", json, query, signal, rawPath } = options;
  const url = `${rawPath ?? `${API_BASE}${path}`}${buildQuery(query)}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (json !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      signal,
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return { data: undefined as T };

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const failure = body as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      response.status,
      failure?.error?.code ?? "INTERNAL_ERROR",
      failure?.error?.message ?? `Request failed with status ${response.status}`,
      failure?.error?.details,
    );
  }

  const success = body as { success?: boolean; data?: T; meta?: ApiEnvelope<T>["meta"] } | null;
  return { data: (success?.data ?? (undefined as T)), meta: success?.meta };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "json">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, json?: unknown, options?: Omit<RequestOptions, "method" | "json">) =>
    request<T>(path, { ...options, method: "POST", json }),
  patch: <T>(path: string, json?: unknown, options?: Omit<RequestOptions, "method" | "json">) =>
    request<T>(path, { ...options, method: "PATCH", json }),
  put: <T>(path: string, json?: unknown, options?: Omit<RequestOptions, "method" | "json">) =>
    request<T>(path, { ...options, method: "PUT", json }),
  delete: <T>(path: string, json?: unknown) => request<T>(path, { method: "DELETE", json }),
};

/** Convenience for endpoints whose payload is the interesting part. */
export async function apiData<T>(envelope: Promise<ApiEnvelope<T>>): Promise<T> {
  return (await envelope).data;
}

export function messageFrom(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
