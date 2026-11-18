import type { Request } from "express";

import { db } from "../db/prisma.ts";
import { logger } from "./logger.ts";

export interface AuditInput {
  messId?: string | null;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

type PrismaLike = Pick<typeof db, "auditLog">;

/** Best-effort audit trail; financial writes must call this inside their transaction. */
export async function writeAuditLog(client: PrismaLike, input: AuditInput): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        messId: input.messId ?? null,
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: (input.before ?? null) as never,
        after: (input.after ?? null) as never,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    // An audit failure must never silently roll back a successful operation,
    // but it must always be visible in the logs.
    logger.error({ err: error, entityType: input.entityType, action: input.action }, "failed to write audit log");
  }
}

export function requestContext(req: Request) {
  return {
    actorUserId: req.auth?.user.id ?? null,
    ip: req.ip,
    userAgent: req.header("user-agent") ?? undefined,
  };
}
