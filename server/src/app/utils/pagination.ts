import type { PaginationMeta } from "./api-response.ts";

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 500;

/** Normalises `page` / `pageSize` query params into safe skip/take values. */
export function parsePagination(query: Record<string, unknown> | undefined, defaults?: Partial<Pagination>): Pagination {
  const toInt = (value: unknown, fallback: number) => {
    const n = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : NaN;
    return Number.isFinite(n) ? n : fallback;
  };

  const page = Math.max(1, toInt(query?.page, defaults?.page ?? 1));
  const rawSize = toInt(query?.pageSize, defaults?.take ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta(pagination: Pagination, total: number): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
