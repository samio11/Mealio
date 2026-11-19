import type { Deposit } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { poishaToTakaString } from "../../app/utils/money.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { assertMonthOpen, ensureMonth } from "../months/months.service.ts";
import type { CreateDepositInput, ListDepositsQuery, RejectDepositInput } from "./deposits.schema.ts";

export interface DepositDto {
  id: string;
  messId: string;
  monthId: string;
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  amountTaka: string;
  method: string;
  reference: string | null;
  status: string;
  note: string | null;
  submittedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

type DepositRow = Deposit & {
  member?: { id: string; displayName: string | null; user?: { name: string } | null } | null;
};

const depositInclude = {
  member: { select: { id: true, displayName: true, user: { select: { name: true } } } },
} as const;

function toDto(deposit: DepositRow): DepositDto {
  return {
    id: deposit.id,
    messId: deposit.messId,
    monthId: deposit.monthId,
    memberId: deposit.memberId,
    memberName: deposit.member?.displayName ?? deposit.member?.user?.name ?? null,
    amountPoisha: deposit.amountPoisha.toString(),
    amountTaka: poishaToTakaString(deposit.amountPoisha),
    method: deposit.method,
    reference: deposit.reference,
    status: deposit.status,
    note: deposit.note,
    submittedById: deposit.submittedById,
    verifiedById: deposit.verifiedById,
    verifiedAt: deposit.verifiedAt?.toISOString() ?? null,
    createdAt: deposit.createdAt.toISOString(),
  };
}

export async function listDeposits(messId: string, query: ListDepositsQuery) {
  const pagination = parsePagination(query);
  let monthId = query.monthId;
  if (!monthId && query.year && query.month) {
    const month = await db.messMonth.findUnique({
      where: { messId_year_month: { messId, year: query.year, month: query.month } },
      select: { id: true },
    });
    monthId = month?.id;
  }

  const where = {
    messId,
    utilityPaymentId: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(monthId ? { monthId } : {}),
  };

  const [total, deposits] = await Promise.all([
    db.deposit.count({ where }),
    db.deposit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: depositInclude,
    }),
  ]);

  return { items: deposits.map(toDto), meta: paginationMeta(pagination, total) };
}

export async function getDeposit(messId: string, depositId: string): Promise<DepositDto> {
  const deposit = await db.deposit.findFirst({ where: { id: depositId, messId, utilityPaymentId: null }, include: depositInclude });
  if (!deposit) throw AppError.notFound("Deposit not found");
  return toDto(deposit);
}

export interface CreateDepositOptions {
  actorUserId: string;
  actorMembershipId: string;
  actorRole: string;
  ctx: Pick<AuditInput, "ip" | "userAgent">;
}

export async function createDeposit(
  messId: string,
  input: CreateDepositInput,
  options: CreateDepositOptions,
): Promise<DepositDto> {
  if (input.amountTaka <= 0n) throw AppError.badRequest("Deposit amount must be greater than zero");

  const memberId = input.memberId ?? options.actorMembershipId;
  if (input.memberId && input.memberId !== options.actorMembershipId && options.actorRole !== "MANAGER") {
    throw AppError.forbidden("Only a manager can record a deposit for another member");
  }

  const member = await db.messMembership.findFirst({
    where: { id: memberId, messId },
    select: { id: true, status: true },
  });
  if (!member) throw AppError.notFound("Member not found in this mess");
  if (member.status !== "ACTIVE") throw AppError.business("Deposits can only be recorded for active members");

  const month = await ensureMonth(messId, { monthId: input.monthId, year: input.year, month: input.month });
  if (month.status === "CLOSED") throw AppError.business("This month is closed; records can no longer be changed");

  const deposit = await db.$transaction(async (tx) => {
    const createdDeposit = await tx.deposit.create({
      data: {
        messId,
        monthId: month.id,
        memberId,
        amountPoisha: input.amountTaka,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        status: "PENDING",
        submittedById: options.actorUserId,
      },
      include: depositInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "Deposit",
      entityId: createdDeposit.id,
      action: "CREATE",
      after: { memberId, amountPoisha: input.amountTaka.toString(), method: input.method, monthId: month.id },
      ...options.ctx,
    });

    return createdDeposit;
  });

  return toDto(deposit);
}

async function loadDepositInMess(messId: string, depositId: string): Promise<Deposit> {
  const deposit = await db.deposit.findFirst({ where: { id: depositId, messId, utilityPaymentId: null } });
  if (!deposit) throw AppError.notFound("Deposit not found");
  return deposit;
}

export async function verifyDeposit(
  messId: string,
  depositId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DepositDto> {
  const before = await loadDepositInMess(messId, depositId);
  await assertMonthOpen(messId, before.monthId);
  if (before.status === "VERIFIED") throw AppError.conflict("This deposit has already been verified");
  if (before.status === "REJECTED") throw AppError.business("A rejected deposit cannot be verified");

  const deposit = await db.$transaction(async (tx) => {
    const updated = await tx.deposit.update({
      where: { id: depositId },
      data: { status: "VERIFIED", verifiedById: actorUserId, verifiedAt: new Date() },
      include: depositInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Deposit",
      entityId: depositId,
      action: "VERIFY",
      before: { status: before.status },
      after: { status: updated.status },
      ...ctx,
    });

    return updated;
  });

  return toDto(deposit);
}

export async function rejectDeposit(
  messId: string,
  depositId: string,
  actorUserId: string,
  input: RejectDepositInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DepositDto> {
  const before = await loadDepositInMess(messId, depositId);
  await assertMonthOpen(messId, before.monthId);
  if (before.status === "VERIFIED") throw AppError.business("A verified deposit cannot be rejected; use an adjustment instead");
  if (before.status === "REJECTED") throw AppError.conflict("This deposit has already been rejected");

  const deposit = await db.$transaction(async (tx) => {
    const updated = await tx.deposit.update({
      where: { id: depositId },
      data: { status: "REJECTED", verifiedById: actorUserId, verifiedAt: new Date(), note: input.reason },
      include: depositInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Deposit",
      entityId: depositId,
      action: "REJECT",
      before: { status: before.status },
      after: { status: updated.status },
      reason: input.reason,
      ...ctx,
    });

    return updated;
  });

  return toDto(deposit);
}

export async function deletePendingDeposit(
  messId: string,
  depositId: string,
  actorUserId: string,
  actorRole: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const deposit = await loadDepositInMess(messId, depositId);
  await assertMonthOpen(messId, deposit.monthId);
  if (deposit.status !== "PENDING") throw AppError.business("Only a pending deposit can be deleted");
  if (deposit.submittedById !== actorUserId && actorRole !== "MANAGER") {
    throw AppError.forbidden("You can only delete a deposit you submitted");
  }

  await db.$transaction(async (tx) => {
    await tx.deposit.delete({ where: { id: depositId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Deposit",
      entityId: depositId,
      action: "DELETE",
      before: { memberId: deposit.memberId, amountPoisha: deposit.amountPoisha.toString() },
      ...ctx,
    });
  });

  return { id: depositId };
}
