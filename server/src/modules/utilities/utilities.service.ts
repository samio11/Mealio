import type { Expense, ExpenseAllocation, UtilityPayment } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly } from "../../app/utils/date.ts";
import { poishaToTakaString } from "../../app/utils/money.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { assertMonthOpen } from "../months/months.service.ts";
import {
  utilityCategories,
  type ListUtilitiesQuery,
  type RejectUtilityPaymentInput,
  type SetUtilityBillPaidInput,
  type SubmitUtilityPaymentInput,
} from "./utilities.schema.ts";

type PaymentRow = UtilityPayment;
type AllocationRow = ExpenseAllocation & {
  member?: { id: string; displayName: string | null; user?: { name: string } | null } | null;
};
type UtilityExpenseRow = Expense & {
  allocations: AllocationRow[];
  utilityPayments: PaymentRow[];
};

export interface UtilityPaymentDto {
  id: string;
  amountPoisha: string;
  method: string;
  reference: string | null;
  note: string | null;
  status: string;
  submittedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface UtilityShareDto {
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  payment: UtilityPaymentDto | null;
}

export interface UtilityBillDto {
  id: string;
  monthId: string;
  category: string;
  createdById: string;
  description: string;
  amountPoisha: string;
  amountTaka: string;
  status: string;
  incurredOn: string;
  utilityBillPaid: boolean;
  utilityBillPaidById: string | null;
  utilityBillPaidAt: string | null;
  note: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  shares: UtilityShareDto[];
  createdAt: string;
}

function paymentToDto(payment: PaymentRow): UtilityPaymentDto {
  return {
    id: payment.id,
    amountPoisha: payment.amountPoisha.toString(),
    method: payment.method,
    reference: payment.reference,
    note: payment.note,
    status: payment.status,
    submittedById: payment.submittedById,
    verifiedById: payment.verifiedById,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    rejectionReason: payment.rejectionReason,
    createdAt: payment.createdAt.toISOString(),
  };
}

function billToDto(expense: UtilityExpenseRow, memberId: string, isManager: boolean): UtilityBillDto {
  return {
    id: expense.id,
    monthId: expense.monthId,
    category: expense.category,
    createdById: expense.createdById,
    description: expense.description,
    amountPoisha: expense.amountPoisha.toString(),
    amountTaka: poishaToTakaString(expense.amountPoisha),
    status: expense.status,
    incurredOn: fromDateOnly(expense.incurredOn),
    utilityBillPaid: expense.utilityBillPaid,
    utilityBillPaidById: expense.utilityBillPaidById,
    utilityBillPaidAt: expense.utilityBillPaidAt?.toISOString() ?? null,
    note: expense.note,
    rejectionReason: expense.rejectionReason,
    approvedAt: expense.approvedAt?.toISOString() ?? null,
    createdAt: expense.createdAt.toISOString(),
    shares: expense.allocations
      .filter((allocation) => isManager || allocation.memberId === memberId)
      .map((allocation) => {
        const payment = expense.utilityPayments.find((item) => item.memberId === allocation.memberId);
        return {
          memberId: allocation.memberId,
          memberName: allocation.member?.displayName ?? allocation.member?.user?.name ?? null,
          amountPoisha: allocation.amountPoisha.toString(),
          payment: payment ? paymentToDto(payment) : null,
        };
      }),
  };
}

const utilityExpenseInclude = {
  allocations: {
    include: {
      member: { select: { id: true, displayName: true, user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  },
  utilityPayments: true,
} as const;

export async function listUtilities(
  messId: string,
  memberId: string,
  isManager: boolean,
  query: ListUtilitiesQuery,
) {
  const pagination = parsePagination(query);
  const where = {
    messId,
    category: { in: [...utilityCategories] },
    ...(query.monthId ? { monthId: query.monthId } : {}),
  };
  const [total, expenses] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({
      where,
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: utilityExpenseInclude,
    }),
  ]);
  return {
    items: expenses.map((expense) => billToDto(expense, memberId, isManager)),
    meta: paginationMeta(pagination, total),
  };
}

export interface UtilityBillPaymentStatusDto {
  id: string;
  paid: boolean;
  paidById: string | null;
  paidAt: string | null;
}

export async function setUtilityBillPaid(
  messId: string,
  expenseId: string,
  actorUserId: string,
  input: SetUtilityBillPaidInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<UtilityBillPaymentStatusDto> {
  const bill = await db.expense.findFirst({
    where: { id: expenseId, messId, category: { in: [...utilityCategories] } },
  });
  if (!bill) throw AppError.notFound("Utility bill not found");
  if (bill.status !== "APPROVED") throw AppError.business("Only a published utility bill can be marked paid");
  await assertMonthOpen(messId, bill.monthId);

  if (bill.utilityBillPaid === input.paid) {
    return {
      id: bill.id,
      paid: bill.utilityBillPaid,
      paidById: bill.utilityBillPaidById,
      paidAt: bill.utilityBillPaidAt?.toISOString() ?? null,
    };
  }

  const paidAt = input.paid ? new Date() : null;
  return db.$transaction(async (tx) => {
    const updated = await tx.expense.updateMany({
      where: { id: expenseId, messId, utilityBillPaid: bill.utilityBillPaid, status: "APPROVED" },
      data: {
        utilityBillPaid: input.paid,
        utilityBillPaidById: input.paid ? actorUserId : null,
        utilityBillPaidAt: paidAt,
      },
    });
    if (updated.count !== 1) throw AppError.conflict("This utility bill status changed; refresh and try again");

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "UtilityBill",
      entityId: expenseId,
      action: input.paid ? "MARK_PAID" : "MARK_NOT_PAID",
      before: { paid: bill.utilityBillPaid, paidAt: bill.utilityBillPaidAt?.toISOString() ?? null },
      after: { paid: input.paid, paidAt: paidAt?.toISOString() ?? null },
      ...ctx,
    });

    return {
      id: expenseId,
      paid: input.paid,
      paidById: input.paid ? actorUserId : null,
      paidAt: paidAt?.toISOString() ?? null,
    };
  });
}

export async function deleteUtilityBill(
  messId: string,
  expenseId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const bill = await db.expense.findFirst({
    where: { id: expenseId, messId, category: { in: [...utilityCategories] } },
  });
  if (!bill) throw AppError.notFound("Utility bill not found");
  if (bill.createdById !== actorUserId) throw AppError.forbidden("Only the manager who created this utility bill can delete it");
  await assertMonthOpen(messId, bill.monthId);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "expenses"
      WHERE "id" = ${expenseId} AND "messId" = ${messId}
      FOR UPDATE
    `;

    const current = await tx.expense.findFirst({
      where: { id: expenseId, messId, category: { in: [...utilityCategories] } },
      include: { utilityPayments: { select: { id: true } } },
    });
    if (!current) throw AppError.notFound("Utility bill not found");
    if (current.createdById !== actorUserId) {
      throw AppError.forbidden("Only the manager who created this utility bill can delete it");
    }
    if (current.status === "REVERSED") throw AppError.business("A reversed utility bill cannot be deleted");
    if (current.utilityBillPaid) throw AppError.business("A utility bill marked paid to the provider cannot be deleted");
    if (current.utilityPayments.length > 0) {
      throw AppError.conflict("A utility bill with member payment requests cannot be deleted");
    }

    const deleted = await tx.expense.deleteMany({
      where: {
        id: expenseId,
        messId,
        createdById: actorUserId,
        status: current.status,
        utilityBillPaid: false,
      },
    });
    if (deleted.count !== 1) throw AppError.conflict("This utility bill changed; refresh and try again");

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "UtilityBill",
      entityId: expenseId,
      action: "DELETE",
      before: {
        category: current.category,
        amountPoisha: current.amountPoisha.toString(),
        status: current.status,
      },
      ...ctx,
    });

    return { id: expenseId };
  });
}

function paymentFromDatabase(payment: UtilityPayment): UtilityPaymentDto {
  return paymentToDto(payment);
}

export async function submitUtilityPayment(
  messId: string,
  expenseId: string,
  memberId: string,
  actorUserId: string,
  input: SubmitUtilityPaymentInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<UtilityPaymentDto> {
  const [expense, membership] = await Promise.all([
    db.expense.findFirst({
      where: { id: expenseId, messId, category: { in: [...utilityCategories] } },
      select: { id: true, monthId: true, status: true },
    }),
    db.messMembership.findFirst({
      where: { id: memberId, messId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  if (!expense) throw AppError.notFound("Utility bill not found");
  if (!membership) throw AppError.forbidden("An active mess membership is required");
  if (expense.status !== "APPROVED") throw AppError.business("This utility bill is not available for payment yet");
  await assertMonthOpen(messId, expense.monthId);

  const allocation = await db.expenseAllocation.findUnique({
    where: { expenseId_memberId: { expenseId, memberId } },
    select: { amountPoisha: true },
  });
  if (!allocation) throw AppError.forbidden("You do not have a share for this utility bill");
  if (allocation.amountPoisha <= 0n) throw AppError.business("There is no amount due for your share");

  const existing = await db.utilityPayment.findUnique({
    where: { expenseId_memberId: { expenseId, memberId } },
  });
  if (existing?.status === "PENDING") throw AppError.conflict("Your payment is already waiting for manager verification");
  if (existing?.status === "VERIFIED") throw AppError.conflict("Your utility bill share has already been paid");

  const payment = await db.$transaction(async (tx) => {
    const result = existing
      ? await tx.utilityPayment.update({
          where: { id: existing.id },
          data: {
            amountPoisha: allocation.amountPoisha,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? null,
            status: "PENDING",
            submittedById: actorUserId,
            verifiedById: null,
            verifiedAt: null,
            rejectionReason: null,
          },
        })
      : await tx.utilityPayment.create({
          data: {
            expenseId,
            memberId,
            amountPoisha: allocation.amountPoisha,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? null,
            submittedById: actorUserId,
          },
        });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "UtilityPayment",
      entityId: result.id,
      action: existing ? "RESUBMIT" : "SUBMIT",
      before: existing ? { status: existing.status } : undefined,
      after: { status: result.status, amountPoisha: result.amountPoisha.toString(), method: result.method },
      ...ctx,
    });
    return result;
  });
  return paymentFromDatabase(payment);
}

async function loadUtilityPayment(messId: string, paymentId: string): Promise<UtilityPayment & { expense: Expense }> {
  const payment = await db.utilityPayment.findFirst({
    where: { id: paymentId, expense: { messId, category: { in: [...utilityCategories] } } },
    include: { expense: true },
  });
  if (!payment) throw AppError.notFound("Utility payment not found");
  return payment;
}

export async function verifyUtilityPayment(
  messId: string,
  paymentId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<UtilityPaymentDto> {
  const before = await loadUtilityPayment(messId, paymentId);
  await assertMonthOpen(messId, before.expense.monthId);
  if (before.status !== "PENDING") throw AppError.business("Only a pending utility payment can be verified");
  if (before.expense.status !== "APPROVED") throw AppError.business("A utility payment can only be verified for an approved bill");

  const payment = await db.$transaction(async (tx) => {
    const updated = await tx.utilityPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "VERIFIED", verifiedById: actorUserId, verifiedAt: new Date(), rejectionReason: null },
    });
    if (updated.count !== 1) throw AppError.conflict("This utility payment has already been processed");

    const result = await tx.utilityPayment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.deposit.create({
      data: {
        messId,
        monthId: before.expense.monthId,
        memberId: result.memberId,
        amountPoisha: result.amountPoisha,
        method: result.method,
        reference: result.reference,
        status: "VERIFIED",
        note: result.note ?? "Utility bill payment",
        submittedById: result.submittedById,
        verifiedById: actorUserId,
        verifiedAt: result.verifiedAt,
        utilityPaymentId: result.id,
      },
    });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "UtilityPayment",
      entityId: paymentId,
      action: "VERIFY",
      before: { status: before.status },
      after: { status: result.status, amountPoisha: result.amountPoisha.toString() },
      ...ctx,
    });
    return result;
  });

  return paymentFromDatabase(payment);
}

export async function rejectUtilityPayment(
  messId: string,
  paymentId: string,
  actorUserId: string,
  input: RejectUtilityPaymentInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<UtilityPaymentDto> {
  const before = await loadUtilityPayment(messId, paymentId);
  await assertMonthOpen(messId, before.expense.monthId);
  if (before.status !== "PENDING") throw AppError.business("Only a pending utility payment can be rejected");

  const payment = await db.$transaction(async (tx) => {
    const updated = await tx.utilityPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "REJECTED", verifiedById: actorUserId, verifiedAt: new Date(), rejectionReason: input.reason },
    });
    if (updated.count !== 1) throw AppError.conflict("This utility payment has already been processed");

    const result = await tx.utilityPayment.findUniqueOrThrow({ where: { id: paymentId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "UtilityPayment",
      entityId: paymentId,
      action: "REJECT",
      before: { status: before.status },
      after: { status: result.status },
      reason: input.reason,
      ...ctx,
    });
    return result;
  });
  return paymentFromDatabase(payment);
}
