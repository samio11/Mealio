import type { BazarDuty } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { eachDateOfMonth, fromDateOnly, toDateOnly, toDhakaDateString } from "../../app/utils/date.ts";
import { ensureMonth } from "../months/months.service.ts";
import { planDuties, rotationOffsetForMonth } from "./duty-scheduler.ts";
import type {
  AssignDutyInput,
  GenerateDutiesInput,
  ListDutiesQuery,
  SwapDutiesInput,
  UpdateDutyStatusInput,
} from "./bazar-duty.schema.ts";

export interface DutyDto {
  id: string;
  date: string;
  assigneeMemberId: string | null;
  assigneeName: string | null;
  status: string;
  isManualOverride: boolean;
  overrideReason: string | null;
  completedAt: string | null;
}

type DutyRow = BazarDuty & {
  assignee?: { displayName: string | null; user?: { name: string } | null } | null;
};

const dutyInclude = {
  assignee: { select: { displayName: true, user: { select: { name: true } } } },
} as const;

function toDto(duty: DutyRow): DutyDto {
  return {
    id: duty.id,
    date: fromDateOnly(duty.date),
    assigneeMemberId: duty.assigneeMemberId,
    assigneeName: duty.assignee?.displayName ?? duty.assignee?.user?.name ?? null,
    status: duty.status,
    isManualOverride: duty.isManualOverride,
    overrideReason: duty.overrideReason,
    completedAt: duty.completedAt?.toISOString() ?? null,
  };
}

export async function listDuties(messId: string, query: ListDutiesQuery): Promise<DutyDto[]> {
  const month = query.monthId
    ? { id: query.monthId }
    : query.year && query.month
      ? await db.messMonth.findUnique({
          where: { messId_year_month: { messId, year: query.year, month: query.month } },
          select: { id: true },
        })
      : undefined;

  const duties = await db.bazarDuty.findMany({
    where: { messId, ...(month?.id ? { monthId: month.id } : {}), ...(query.status ? { status: query.status } : {}) },
    orderBy: { date: "asc" },
    include: dutyInclude,
  });

  return duties.map(toDto);
}

async function eligibleMembers(messId: string, memberIds?: string[]) {
  const members = await db.messMembership.findMany({
    where: {
      messId,
      status: "ACTIVE",
      isDutyEligible: true,
      ...(memberIds ? { id: { in: memberIds } } : {}),
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (memberIds && members.length !== new Set(memberIds).size) {
    throw AppError.badRequest("One or more eligible members were not found (or are not duty-eligible)");
  }
  return members;
}

/**
 * Generates (or regenerates) the month's duty roster.
 *
 * Completed/skipped duties, manual overrides, and past dates are preserved;
 * only future, uncompleted, non-overridden dates are recalculated. This keeps
 * history intact while redistributing work after membership changes.
 */
export async function generateDuties(
  messId: string,
  actorUserId: string,
  input: GenerateDutiesInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DutyDto[]> {
  const month = await ensureMonth(messId, { monthId: input.monthId, year: input.year, month: input.month });
  const members = await eligibleMembers(messId, input.eligibleMemberIds);
  if (members.length === 0) throw AppError.business("No duty-eligible active members were found");

  const allDates = input.dates ?? eachDateOfMonth(month.year, month.month);
  const today = toDhakaDateString();

  const existing = await db.bazarDuty.findMany({ where: { messId, monthId: month.id } });
  const existingByDate = new Map(existing.map((duty) => [fromDateOnly(duty.date), duty]));

  const preserved = (duty: BazarDuty): boolean =>
    duty.status !== "SCHEDULED" ||
    (input.preserveOverrides && duty.isManualOverride) ||
    fromDateOnly(duty.date) < today;

  const targetDates = allDates.filter((date) => {
    const duty = existingByDate.get(date);
    return !duty || !preserved(duty);
  });

  const plan = planDuties(members.map((m) => m.id), targetDates, rotationOffsetForMonth(month.year, month.month));

  await db.$transaction(async (tx) => {
    const newDuties = plan
      .filter((slot) => !existingByDate.has(slot.date))
      .map((slot) => ({
        messId,
        monthId: month.id,
        date: toDateOnly(slot.date),
        assigneeMemberId: slot.memberIndex === null ? null : members[slot.memberIndex]?.id ?? null,
        status: "SCHEDULED" as const,
        isManualOverride: false,
        createdById: actorUserId,
      }));

    if (newDuties.length > 0) {
      await tx.bazarDuty.createMany({ data: newDuties, skipDuplicates: true });
    }

    const updatesByAssignee = new Map<string | null, string[]>();
    for (const slot of plan) {
      if (!existingByDate.has(slot.date)) continue;
      const assigneeMemberId = slot.memberIndex === null ? null : members[slot.memberIndex]?.id ?? null;
      const dates = updatesByAssignee.get(assigneeMemberId) ?? [];
      dates.push(slot.date);
      updatesByAssignee.set(assigneeMemberId, dates);
    }

    await Promise.all(
      [...updatesByAssignee].map(([assigneeMemberId, dates]) =>
        tx.bazarDuty.updateMany({
          where: {
            messId,
            monthId: month.id,
            date: { in: dates.map(toDateOnly) },
            status: "SCHEDULED",
            ...(input.preserveOverrides ? { isManualOverride: false } : {}),
          },
          data: {
            assigneeMemberId,
            status: "SCHEDULED",
            isManualOverride: false,
            overrideReason: null,
          },
        }),
      ),
    );

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarDuty",
      entityId: month.id,
      action: "GENERATE",
      after: {
        monthId: month.id,
        generatedDates: targetDates.length,
        preservedDates: allDates.length - targetDates.length,
        eligibleMembers: members.length,
      },
      ...ctx,
    });
  });

  return listDuties(messId, { monthId: month.id });
}

async function loadDuty(messId: string, dutyId: string): Promise<BazarDuty> {
  const duty = await db.bazarDuty.findFirst({ where: { id: dutyId, messId } });
  if (!duty) throw AppError.notFound("Duty not found");
  return duty;
}

export async function assignDuty(
  messId: string,
  dutyId: string,
  actorUserId: string,
  input: AssignDutyInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DutyDto> {
  const duty = await loadDuty(messId, dutyId);
  if (duty.status === "COMPLETED") throw AppError.business("A completed duty cannot be reassigned");

  if (input.assigneeMemberId) {
    const member = await db.messMembership.findFirst({ where: { id: input.assigneeMemberId, messId }, select: { id: true } });
    if (!member) throw AppError.notFound("Member not found in this mess");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.bazarDuty.update({
      where: { id: dutyId },
      data: {
        assigneeMemberId: input.assigneeMemberId,
        isManualOverride: true,
        overrideReason: input.reason,
        status: "SCHEDULED",
      },
      include: dutyInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarDuty",
      entityId: dutyId,
      action: "REASSIGN",
      before: { assigneeMemberId: duty.assigneeMemberId, status: duty.status },
      after: { assigneeMemberId: result.assigneeMemberId, status: result.status },
      reason: input.reason,
      ...ctx,
    });

    return result;
  });

  return toDto(updated);
}

export async function updateDutyStatus(
  messId: string,
  dutyId: string,
  actorUserId: string,
  input: UpdateDutyStatusInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DutyDto> {
  const duty = await loadDuty(messId, dutyId);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.bazarDuty.update({
      where: { id: dutyId },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
        ...(input.reason ? { overrideReason: input.reason } : {}),
      },
      include: dutyInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarDuty",
      entityId: dutyId,
      action: `STATUS_${input.status}`,
      before: { status: duty.status },
      after: { status: result.status },
      reason: input.reason,
      ...ctx,
    });

    return result;
  });

  return toDto(updated);
}

export async function swapDuties(
  messId: string,
  actorUserId: string,
  input: SwapDutiesInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<DutyDto[]> {
  const [from, to] = await Promise.all([loadDuty(messId, input.fromDutyId), loadDuty(messId, input.toDutyId)]);
  if (from.id === to.id) throw AppError.badRequest("Choose two different duty dates to swap");
  if (from.status === "COMPLETED" || to.status === "COMPLETED") {
    throw AppError.business("Completed duties cannot be swapped");
  }

  await db.$transaction(async (tx) => {
    await tx.bazarDuty.update({
      where: { id: from.id },
      data: { assigneeMemberId: to.assigneeMemberId, isManualOverride: true, overrideReason: input.reason ?? "Swap" },
    });
    await tx.bazarDuty.update({
      where: { id: to.id },
      data: { assigneeMemberId: from.assigneeMemberId, isManualOverride: true, overrideReason: input.reason ?? "Swap" },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarDuty",
      entityId: from.id,
      action: "SWAP",
      before: { from: from.assigneeMemberId, to: to.assigneeMemberId },
      after: { from: to.assigneeMemberId, to: from.assigneeMemberId },
      reason: input.reason,
      ...ctx,
    });
  });

  return listDuties(messId, { monthId: from.monthId });
}
