import type { MessMembership } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import type { ListMembersQuery, UpdateMembershipInput } from "./memberships.schema.ts";

export interface MemberDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  status: string;
  displayName: string | null;
  phone: string | null;
  isDutyEligible: boolean;
  joinedAt: string;
  leftAt: string | null;
}

type MembershipRow = MessMembership & {
  user: { id: string; name: string; email: string; image: string | null };
};

const memberInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

function toMemberDto(m: MembershipRow): MemberDto {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    status: m.status,
    displayName: m.displayName,
    phone: m.phone,
    isDutyEligible: m.isDutyEligible,
    joinedAt: m.joinedAt.toISOString(),
    leftAt: m.leftAt?.toISOString() ?? null,
  };
}

type TxLike = Pick<typeof db, "messMembership">;

/**
 * Invariant: a mess must never be left without an active manager, otherwise
 * nobody could approve deposits, expenses or close a month.
 */
async function assertKeepsOneActiveManager(client: TxLike, messId: string, membershipId: string): Promise<void> {
  const remaining = await client.messMembership.count({
    where: { messId, role: "MANAGER", status: "ACTIVE", id: { not: membershipId } },
  });
  if (remaining === 0) {
    throw AppError.business("A mess must always keep at least one active manager");
  }
}

export async function listMembers(messId: string, query: ListMembersQuery): Promise<MemberDto[]> {
  const statuses = query.status
    ? [query.status]
    : query.includeRemoved
      ? ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]
      : ["INVITED", "ACTIVE", "SUSPENDED"];

  const members = await db.messMembership.findMany({
    where: {
      messId,
      status: { in: statuses as never },
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search } },
              { user: { name: { contains: query.search, mode: "insensitive" } } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: memberInclude,
  });

  return members.map(toMemberDto);
}

export async function getMember(messId: string, memberId: string): Promise<MemberDto> {
  const member = await db.messMembership.findFirst({
    where: { id: memberId, messId },
    include: memberInclude,
  });
  if (!member) throw AppError.notFound("Member not found in this mess");
  return toMemberDto(member);
}

export interface UpdateMemberOptions {
  actorUserId: string;
  actorRole: string;
  ctx: Pick<AuditInput, "ip" | "userAgent">;
}

export async function updateMember(
  messId: string,
  memberId: string,
  input: UpdateMembershipInput,
  options: UpdateMemberOptions,
): Promise<MemberDto> {
  const before = await db.messMembership.findFirst({ where: { id: memberId, messId } });
  if (!before) throw AppError.notFound("Member not found in this mess");

  const isSelf = before.userId === options.actorUserId;
  const isManager = options.actorRole === "MANAGER";
  const changesPrivilege = input.role !== undefined || input.status !== undefined;

  if (changesPrivilege && !isManager) {
    throw AppError.forbidden("Only a mess manager can change a member's role or status");
  }
  if (!isManager && !isSelf) {
    throw AppError.forbidden("You can only update your own membership details");
  }

  const updated = await db.$transaction(async (tx) => {
    // Demoting or suspending the last manager would strand the mess.
    const losesManager =
      before.role === "MANAGER" &&
      before.status === "ACTIVE" &&
      ((input.role !== undefined && input.role !== "MANAGER") ||
        (input.status !== undefined && input.status !== "ACTIVE"));
    if (losesManager) await assertKeepsOneActiveManager(tx, messId, memberId);

    const member = await tx.messMembership.update({
      where: { id: memberId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.isDutyEligible !== undefined ? { isDutyEligible: input.isDutyEligible } : {}),
      },
      include: memberInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "MessMembership",
      entityId: memberId,
      action: "UPDATE",
      before: { role: before.role, status: before.status, displayName: before.displayName, isDutyEligible: before.isDutyEligible },
      after: { role: member.role, status: member.status, displayName: member.displayName, isDutyEligible: member.isDutyEligible },
      ...options.ctx,
    });

    return member;
  });

  return toMemberDto(updated);
}

/**
 * Removes a member by marking the membership REMOVED (soft delete). Financial
 * history references the membership, so rows are never hard-deleted.
 */
export async function removeMember(
  messId: string,
  memberId: string,
  options: UpdateMemberOptions,
): Promise<MemberDto> {
  const before = await db.messMembership.findFirst({ where: { id: memberId, messId } });
  if (!before) throw AppError.notFound("Member not found in this mess");
  if (before.status === "REMOVED") throw AppError.conflict("This member has already been removed");
  if (before.role === "MANAGER" && before.status === "ACTIVE") {
    await assertKeepsOneActiveManager(db, messId, memberId);
  }

  const updated = await db.$transaction(async (tx) => {
    const member = await tx.messMembership.update({
      where: { id: memberId },
      data: { status: "REMOVED", leftAt: new Date() },
      include: memberInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "MessMembership",
      entityId: memberId,
      action: "REMOVE",
      before: { status: before.status, role: before.role },
      after: { status: member.status, leftAt: member.leftAt },
      ...options.ctx,
    });

    return member;
  });

  return toMemberDto(updated);
}
