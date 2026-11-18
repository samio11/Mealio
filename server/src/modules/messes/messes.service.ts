import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import type { CreateMessInput, UpdateMessInput } from "./messes.schema.ts";

export interface MessDto {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  archived: boolean;
  myRole: string;
  createdAt: string;
}

type MessRow = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  archivedAt: Date | null;
  createdAt: Date;
};

function toMessDto(mess: MessRow, myRole: string): MessDto {
  return {
    id: mess.id,
    name: mess.name,
    area: mess.area,
    address: mess.address,
    currency: mess.currency,
    timezone: mess.timezone,
    archived: mess.archivedAt !== null,
    myRole,
    createdAt: mess.createdAt.toISOString(),
  };
}

/**
 * Creates a mess and makes the creator its first MANAGER.
 * Mess + membership are written in one transaction, then audited.
 */
export async function createMess(
  userId: string,
  input: CreateMessInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MessDto> {
  const result = await db.$transaction(async (tx) => {
    const mess = await tx.mess.create({
      data: {
        name: input.name,
        area: input.area ?? null,
        address: input.address ?? null,
        createdById: userId,
      },
    });

    await tx.messMembership.create({
      data: {
        messId: mess.id,
        userId,
        role: "MANAGER",
        status: "ACTIVE",
      },
    });

    await writeAuditLog(tx, {
      messId: mess.id,
      actorUserId: userId,
      entityType: "Mess",
      entityId: mess.id,
      action: "CREATE",
      after: { name: mess.name, area: mess.area },
      ...ctx,
    });

    return mess;
  });

  return toMessDto(result, "MANAGER");
}

export async function getMess(messId: string, myRole: string, userId: string): Promise<MessDto> {
  const mess = await db.mess.findUnique({ where: { id: messId } });
  if (!mess) throw AppError.notFound("Mess not found");
  return toMessDto(mess, myRole);
}

export async function updateMess(
  messId: string,
  input: UpdateMessInput,
  userId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MessDto> {
  const before = await db.mess.findUnique({ where: { id: messId } });
  if (!before) throw AppError.notFound("Mess not found");

  const updated = await db.$transaction(async (tx) => {
    const mess = await tx.mess.update({
      where: { id: messId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.area !== undefined ? { area: input.area } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.archived !== undefined
          ? { archivedAt: input.archived ? new Date() : null }
          : {}),
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId: userId,
      entityType: "Mess",
      entityId: messId,
      action: "UPDATE",
      before: { name: before.name, area: before.area, address: before.address, archivedAt: before.archivedAt },
      after: { name: mess.name, area: mess.area, address: mess.address, archivedAt: mess.archivedAt },
      ...ctx,
    });

    return mess;
  });

  return toMessDto(updated, "MANAGER");
}
