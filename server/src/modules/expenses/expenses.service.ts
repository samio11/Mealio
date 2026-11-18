import type { Expense, ExpenseAllocation } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly, toDateOnly } from "../../app/utils/date.ts";
import { allocateByWeights, poishaToTakaString } from "../../app/utils/money.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { getMealCountsByMember } from "../meals/meals.service.ts";
import { assertMonthOpen, ensureMonth } from "../months/months.service.ts";
import type {
  CreateExpenseInput,
  ListExpensesQuery,
  RejectExpenseInput,
  ReverseExpenseInput,
} from "./expenses.schema.ts";

export interface AllocationDto {
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  mealCount: number | null;
}

export interface ExpenseDto {
  id: string;
  messId: string;
  monthId: string;
  category: string;
  amountPoisha: string;
  amountTaka: string;
  description: string;
  allocationMethod: string;
  status: string;
  incurredOn: string;
  note: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  reversalOfId: string | null;
  bazarEntryId: string | null;
  allocations?: AllocationDto[];
  createdAt: string;
}

type ExpenseRow = Expense & {
  allocations?: (ExpenseAllocation & { member?: { displayName: string | null; user?: { name: string } | null } | null })[];
};

function toDto(expense: ExpenseRow, withAllocations = false): ExpenseDto {
  return {
    id: expense.id,
    messId: expense.messId,
    monthId: expense.monthId,
    category: expense.category,
    amountPoisha: expense.amountPoisha.toString(),
    amountTaka: poishaToTakaString(expense.amountPoisha),
    description: expense.description,
    allocationMethod: expense.allocationMethod,
    status: expense.status,
    incurredOn: fromDateOnly(expense.incurredOn),
    note: expense.note,
    createdById: expense.createdById,
    approvedById: expense.approvedById,
    approvedAt: expense.approvedAt?.toISOString() ?? null,
    rejectionReason: expense.rejectionReason,
    reversalOfId: expense.reversalOfId,
    bazarEntryId: expense.bazarEntryId,
    createdAt: expense.createdAt.toISOString(),
    ...(withAllocations
      ? {
          allocations: (expense.allocations ?? []).map((a) => ({
            memberId: a.memberId,
            memberName: a.member?.displayName ?? a.member?.user?.name ?? null,
            amountPoisha: a.amountPoisha.toString(),
            mealCount: a.mealCount,
          })),
        }
      : {}),
  };
}

const allocationInclude = {
  allocations: {
    include: { member: { select: { displayName: true, user: { select: { name: true } } } } },
  },
} as const;

export async function listExpenses(messId: string, query: ListExpensesQuery) {
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
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(monthId ? { monthId } : {}),
  };

  const [total, expenses] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({
      where,
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return { items: expenses.map((e) => toDto(e)), meta: paginationMeta(pagination, total) };
}

export async function getExpense(messId: string, expenseId: string): Promise<ExpenseDto> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, messId }, include: allocationInclude });
  if (!expense) throw AppError.notFound("Expense not found");
  return toDto(expense, true);
}

interface AllocationPlan {
  memberId: string;
  amountPoisha: bigint;
  mealCount: number | null;
}

/**
 * Builds the allocation plan for an expense.
 * - EQUAL: split equally across active members.
 * - MEAL_COUNT: split proportionally to the month's meal counts (falls back to EQUAL when there are no meals).
 * - CUSTOM: use the caller-supplied amounts (validated against active members).
 */
async function buildAllocationPlan(
  messId: string,
  monthId: string,
  amountPoisha: bigint,
  method: string,
  custom?: { memberId: string; amountTaka: bigint }[],
): Promise<AllocationPlan[]> {
  if (method === "CUSTOM") {
    const entries = custom ?? [];
    if (entries.length === 0) throw AppError.badRequest("Custom allocation requires allocation entries");
    const total = entries.reduce((sum, e) => sum + e.amountTaka, 0n);
    if (total !== amountPoisha) {
      throw AppError.business("Custom allocations must add up to the expense amount");
    }
    const valid = await db.messMembership.findMany({
      where: { messId, id: { in: entries.map((e) => e.memberId) } },
      select: { id: true },
    });
    if (valid.length !== new Set(entries.map((e) => e.memberId)).size) {
      throw AppError.badRequest("One or more allocation members were not found in this mess");
    }
    return entries.map((e) => ({ memberId: e.memberId, amountPoisha: e.amountTaka, mealCount: null }));
  }

  const members = await db.messMembership.findMany({
    where: { messId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { joinedAt: "asc" },
  });
  if (members.length === 0) throw AppError.business("This mess has no active members to allocate to");

  if (method === "MEAL_COUNT") {
    const counts = await getMealCountsByMember(messId, monthId);
    const weights = members.map((m) => BigInt(counts.get(m.id) ?? 0));
    const totalWeight = weights.reduce((a, b) => a + b, 0n);
    if (totalWeight === 0n) {
      const share = allocateByWeights(amountPoisha, members.map(() => 1n));
      return members.map((m, index) => ({ memberId: m.id, amountPoisha: share[index] ?? 0n, mealCount: 0 }));
    }
    const share = allocateByWeights(amountPoisha, weights);
    return members.map((m, index) => ({
      memberId: m.id,
      amountPoisha: share[index] ?? 0n,
      mealCount: counts.get(m.id) ?? 0,
    }));
  }

  const share = allocateByWeights(amountPoisha, members.map(() => 1n));
  return members.map((m, index) => ({ memberId: m.id, amountPoisha: share[index] ?? 0n, mealCount: null }));
}

export async function createExpense(
  messId: string,
  actorUserId: string,
  input: CreateExpenseInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<ExpenseDto> {
  if (input.amountTaka <= 0n) throw AppError.badRequest("Expense amount must be greater than zero");

  const month = await ensureMonth(messId, { monthId: input.monthId, year: input.year, month: input.month });
  if (month.status === "CLOSED") throw AppError.business("This month is closed; records can no longer be changed");

  const expense = await db.$transaction(async (tx) => {
    const createdExpense = await tx.expense.create({
      data: {
        messId,
        monthId: month.id,
        category: input.category,
        amountPoisha: input.amountTaka,
        description: input.description,
        allocationMethod: input.allocationMethod,
        status: "PENDING",
        incurredOn: toDateOnly(input.incurredOn),
        note: input.note ?? null,
        createdById: actorUserId,
      },
    });

    if (input.allocationMethod === "CUSTOM" && input.allocations) {
      const plan = await buildAllocationPlan(messId, month.id, input.amountTaka, "CUSTOM", input.allocations);
      await Promise.all(
        plan.map((p) =>
          tx.expenseAllocation.create({
            data: { expenseId: createdExpense.id, memberId: p.memberId, amountPoisha: p.amountPoisha, mealCount: p.mealCount },
          }),
        ),
      );
    }

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Expense",
      entityId: createdExpense.id,
      action: "CREATE",
      after: { category: input.category, amountPoisha: input.amountTaka.toString(), monthId: month.id },
      ...ctx,
    });

    return createdExpense;
  });

  return toDto(expense);
}

export async function approveExpense(
  messId: string,
  expenseId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<ExpenseDto> {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, messId },
    include: { allocations: true },
  });
  if (!expense) throw AppError.notFound("Expense not found");
  await assertMonthOpen(messId, expense.monthId);
  if (expense.status === "APPROVED") throw AppError.conflict("This expense is already approved");
  if (expense.status === "REJECTED") throw AppError.business("A rejected expense cannot be approved");
  if (expense.status === "REVERSED") throw AppError.business("A reversed expense cannot be approved");

  const plan =
    expense.allocationMethod === "CUSTOM" && expense.allocations.length > 0
      ? null
      : await buildAllocationPlan(messId, expense.monthId, expense.amountPoisha, expense.allocationMethod);

  const updated = await db.$transaction(async (tx) => {
    if (plan) {
      await Promise.all(
        plan.map((p) =>
          tx.expenseAllocation.upsert({
            where: { expenseId_memberId: { expenseId, memberId: p.memberId } },
            create: { expenseId, memberId: p.memberId, amountPoisha: p.amountPoisha, mealCount: p.mealCount },
            update: { amountPoisha: p.amountPoisha, mealCount: p.mealCount },
          }),
        ),
      );
    }

    const result = await tx.expense.update({
      where: { id: expenseId },
      data: { status: "APPROVED", approvedById: actorUserId, approvedAt: new Date() },
      include: allocationInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Expense",
      entityId: expenseId,
      action: "APPROVE",
      before: { status: expense.status },
      after: { status: result.status, allocationMethod: result.allocationMethod },
      ...ctx,
    });

    return result;
  });

  return toDto(updated, true);
}

export async function rejectExpense(
  messId: string,
  expenseId: string,
  actorUserId: string,
  input: RejectExpenseInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<ExpenseDto> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, messId } });
  if (!expense) throw AppError.notFound("Expense not found");
  await assertMonthOpen(messId, expense.monthId);
  if (expense.status !== "PENDING") throw AppError.business(`Only a pending expense can be rejected (current: ${expense.status})`);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id: expenseId },
      data: { status: "REJECTED", approvedById: actorUserId, approvedAt: new Date(), rejectionReason: input.reason },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Expense",
      entityId: expenseId,
      action: "REJECT",
      before: { status: expense.status },
      after: { status: result.status },
      reason: input.reason,
      ...ctx,
    });

    return result;
  });

  return toDto(updated);
}

/**
 * Reverses an approved expense by posting an opposite adjustment entry. The
 * original row is never deleted; it is marked REVERSED and linked to the
 * reversal so the ledger stays auditable.
 */
export async function reverseExpense(
  messId: string,
  expenseId: string,
  actorUserId: string,
  input: ReverseExpenseInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<ExpenseDto> {
  const original = await db.expense.findFirst({ where: { id: expenseId, messId } });
  if (!original) throw AppError.notFound("Expense not found");
  await assertMonthOpen(messId, original.monthId);
  if (original.status !== "APPROVED") throw AppError.business("Only an approved expense can be reversed");
  if (original.reversalOfId) throw AppError.business("A reversal entry cannot itself be reversed");

  const existingReversal = await db.expense.findFirst({ where: { reversalOfId: expenseId }, select: { id: true } });
  if (existingReversal) throw AppError.conflict("This expense has already been reversed");

  const reversal = await db.$transaction(async (tx) => {
    const createdReversal = await tx.expense.create({
      data: {
        messId,
        monthId: original.monthId,
        category: "REFUND_ADJUSTMENT",
        amountPoisha: -original.amountPoisha,
        description: `Reversal of: ${original.description}`,
        allocationMethod: original.allocationMethod,
        status: "APPROVED",
        incurredOn: original.incurredOn,
        note: input.reason,
        createdById: actorUserId,
        approvedById: actorUserId,
        approvedAt: new Date(),
        reversalOfId: original.id,
      },
    });

    // Mirror the original allocations with negated amounts when present.
    const originalAllocations = await tx.expenseAllocation.findMany({ where: { expenseId } });
    if (originalAllocations.length > 0) {
      await Promise.all(
        originalAllocations.map((a) =>
          tx.expenseAllocation.create({
            data: { expenseId: createdReversal.id, memberId: a.memberId, amountPoisha: -a.amountPoisha, mealCount: a.mealCount },
          }),
        ),
      );
    }

    await tx.expense.update({ where: { id: expenseId }, data: { status: "REVERSED" } });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Expense",
      entityId: expenseId,
      action: "REVERSE",
      before: { status: original.status },
      after: { status: "REVERSED", reversalExpenseId: createdReversal.id },
      reason: input.reason,
      ...ctx,
    });

    return createdReversal;
  });

  return toDto(reversal);
}

export async function deletePendingExpense(
  messId: string,
  expenseId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, messId } });
  if (!expense) throw AppError.notFound("Expense not found");
  await assertMonthOpen(messId, expense.monthId);
  if (expense.status !== "PENDING") throw AppError.business("Only a pending expense can be deleted");

  await db.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Expense",
      entityId: expenseId,
      action: "DELETE",
      before: { category: expense.category, amountPoisha: expense.amountPoisha.toString() },
      ...ctx,
    });
  });

  return { id: expenseId };
}
