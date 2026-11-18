import type { RequestHandler } from "express";

import { db } from "../db/prisma.ts";
import { AppError } from "../utils/app-error.ts";

export interface TenantOptions {
  /** Require the caller to be a MANAGER of the mess. */
  manager?: boolean;
  /**
   * Allow memberships that are not ACTIVE (used by invitation-acceptance flows).
   * Defaults to false.
   */
  allowInactive?: boolean;
}

/** Reads the mess id the client is acting on. Never trusted on its own. */
function readMessId(req: Parameters<RequestHandler>[0]): string | undefined {
  const fromParams = (req.params as Record<string, string | undefined>)?.messId;
  const fromHeader = req.header("x-mess-id") ?? undefined;
  const fromQuery = typeof req.query?.messId === "string" ? req.query.messId : undefined;
  const fromBody =
    req.body && typeof req.body === "object" && typeof (req.body as { messId?: unknown }).messId === "string"
      ? ((req.body as { messId: string }).messId as string)
      : undefined;
  return fromParams ?? fromHeader ?? fromQuery ?? fromBody;
}

/**
 * Multi-tenant guard.
 *
 * The client-supplied mess id is only a *hint*: access is granted solely by an
 * ACTIVE membership row for the authenticated user. Cross-mess access is denied
 * with 403/404 rather than leaking existence.
 */
export function requireMessAccess(options: TenantOptions = {}): RequestHandler {
  return (req, _res, next) => {
    const run = async () => {
      const user = req.auth?.user;
      if (!user) throw AppError.unauthorized();

      const messId = readMessId(req);
      if (!messId) throw AppError.badRequest("A messId is required for this operation");

      const membership = await db.messMembership.findUnique({
        where: { messId_userId: { messId, userId: user.id } },
        include: { mess: { select: { id: true, name: true, timezone: true, archivedAt: true } } },
      });

      if (!membership) throw AppError.forbidden("You are not a member of this mess");
      if (!options.allowInactive && membership.status !== "ACTIVE") {
        throw AppError.forbidden("Your membership in this mess is not active");
      }
      if (options.manager && membership.role !== "MANAGER") {
        throw AppError.forbidden("Only a mess manager can perform this action");
      }

      req.auth = { ...req.auth!, membership, messId };
      next();
    };

    void run().catch(next);
  };
}

/** Convenience guard for manager-only routes. */
export const requireMessManager = requireMessAccess({ manager: true });
