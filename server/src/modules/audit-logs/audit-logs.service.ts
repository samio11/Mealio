import type { AuditLog } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { toDateOnly } from "../../app/utils/date.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import type { ListAuditLogsQuery } from "./audit-logs.schema.ts";

export interface AuditLogDto {
  id: string;
  messId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

type AuditRow = AuditLog & { actor?: { name: string } | null };

function toDto(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    messId: row.messId,
    actorUserId: row.actorUserId,
    actorName: row.actor?.name ?? null,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    before: row.before,
    after: row.after,
    reason: row.reason,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Inclusive audit-log date range from Dhaka calendar date strings. */
function buildDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = toDateOnly(from);
  if (to) {
    // Inclusive of the whole `to` day.
    const end = toDateOnly(to);
    end.setUTCDate(end.getUTCDate() + 1);
    range.lte = end;
  }
  return range;
}

/** Read-only access to the immutable audit trail of a mess. */
export async function listAuditLogs(messId: string, query: ListAuditLogsQuery) {
  const pagination = parsePagination(query);

  const range = buildDateRange(query.from, query.to);

  const where = {
    messId,
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(range ? { createdAt: range } : {}),
  };

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return { items: rows.map(toDto), meta: paginationMeta(pagination, total) };
}
