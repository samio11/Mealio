import type { MessMonth } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { daysInMonth } from "../../app/utils/date.ts";
import { divideRoundHalfUp, poishaToTakaString } from "../../app/utils/money.ts";
import { getMealCounts } from "../meals/meals.service.ts";
import type { MonthReportQuery } from "./reports.schema.ts";

/** Category used for the opposite entry created when an approved expense is reversed. */
const REVERSAL_CATEGORY = "REFUND_ADJUSTMENT";
const MEAL_CATEGORY = "MEAL_BAZAR";

export interface CategoryTotal {
  category: string;
  amountPoisha: string;
  amountTaka: string;
}

export interface MemberBalanceRow {
  memberId: string;
  memberName: string | null;
  role: string;
  status: string;
  mealCount: number;
  mealCostPoisha: string;
  mealCostTaka: string;
  verifiedDepositsPoisha: string;
  verifiedDepositsTaka: string;
  allocatedChargesPoisha: string;
  allocatedChargesTaka: string;
  creditsPoisha: string;
  debitsPoisha: string;
  adjustmentsPoisha: string;
  balancePoisha: string;
  balanceTaka: string;
}

export interface MonthlyReport {
  month: { id: string; year: number; month: number; label: string; status: string; daysInMonth: number };
  meal: {
    totalMealCount: number;
    mealExpensePoisha: string;
    mealExpenseTaka: string;
    mealRatePoisha: string;
    mealRateTaka: string;
  };
  expenses: {
    totalApprovedPoisha: string;
    totalApprovedTaka: string;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    byCategory: CategoryTotal[];
  };
  deposits: {
    verifiedTotalPoisha: string;
    verifiedTotalTaka: string;
    pendingTotalPoisha: string;
    pendingTotalTaka: string;
    verifiedCount: number;
    pendingCount: number;
  };
  cash: {
    openingCashPoisha: string;
    openingCashTaka: string;
    confirmedInflowsPoisha: string;
    approvedPaymentsPoisha: string;
    closingCashPoisha: string;
    closingCashTaka: string;
  };
  budget: {
    budgetPoisha: string;
    budgetTaka: string;
    spentPoisha: string;
    remainingPoisha: string;
    remainingTaka: string;
    utilisationPercent: number;
  };
  members: MemberBalanceRow[];
  totals: {
    memberMealCostPoisha: string;
    memberAllocatedPoisha: string;
    memberBalancePoisha: string;
    outstandingPoisha: string;
    advancePoisha: string;
  };
  generatedAt: string;
}

function monthLabel(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, "0")}`;
}

/** Resolves an existing month, addressed by id or by a (year, month) pair. */
async function resolveMonth(messId: string, query: MonthReportQuery): Promise<MessMonth> {
  if (query.monthId) {
    const month = await db.messMonth.findFirst({ where: { id: query.monthId, messId } });
    if (!month) throw AppError.notFound("Month not found in this mess");
    return month;
  }
  if (query.year === undefined || query.month === undefined) {
    throw AppError.badRequest("Provide either monthId or both year and month");
  }
  const month = await db.messMonth.findUnique({
    where: { messId_year_month: { messId, year: query.year, month: query.month } },
  });
  if (!month) throw AppError.notFound(`No data for ${monthLabel(query.year, query.month)}`);
  return month;
}

interface EffectiveExpense {
  category: string;
  amountPoisha: bigint;
}

/**
 * An expense's effective category: a reversal inherits the category of the
 * expense it reverses, so refunds reduce the right bucket (e.g. reversing a
 * bazar expense reduces meal expenses rather than creating an "other" charge).
 */
function effectiveCategory(category: string, reversedCategory: string | null | undefined): string {
  return category === REVERSAL_CATEGORY && reversedCategory ? reversedCategory : category;
}

/** Builds the full monthly financial report from stored, approved data. */
export async function getMonthlyReport(messId: string, query: MonthReportQuery): Promise<MonthlyReport> {
  const month = await resolveMonth(messId, query);

  const [mealCounts, expenses, deposits, adjustments] = await Promise.all([
    getMealCounts(messId, month.id),
    db.expense.findMany({
      where: { messId, monthId: month.id },
      select: {
        category: true,
        amountPoisha: true,
        status: true,
        reversalOfId: true,
        reversalOf: { select: { category: true } },
      },
    }),
    db.deposit.findMany({
      where: { messId, monthId: month.id },
      select: { memberId: true, amountPoisha: true, status: true },
    }),
    db.memberAdjustment.findMany({
      where: { messId, monthId: month.id },
      select: { memberId: true, type: true, amountPoisha: true },
    }),
  ]);

  // Ledger entries that have been approved (and, for a reversal, the original
  // row it corrects). A reversal posts a negative amount that inherits the
  // original's category, so both rows must be counted for the net effect to be
  // zero — excluding the REVERSED original while counting its negative offset
  // would double-subtract the correction.
  const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "REVERSED");
  const effective: EffectiveExpense[] = approved.map((e) => ({
    category: effectiveCategory(e.category, e.reversalOf?.category ?? null),
    amountPoisha: e.amountPoisha,
  }));

  const byCategoryMap = new Map<string, bigint>();
  let totalApproved = 0n;
  let mealExpense = 0n;
  for (const e of effective) {
    totalApproved += e.amountPoisha;
    if (e.category === MEAL_CATEGORY) mealExpense += e.amountPoisha;
    byCategoryMap.set(e.category, (byCategoryMap.get(e.category) ?? 0n) + e.amountPoisha);
  }

  const totalMealCount = mealCounts.reduce((sum, c) => sum + c.total, 0);
  const mealRate = totalMealCount > 0 ? divideRoundHalfUp(mealExpense, BigInt(totalMealCount)) : 0n;

  // Allocations on approved expenses, excluding meal-bazar (distributed via meal rate).
  // Reversed originals and their negative reversals are both included so they cancel out.
  const allocations = await db.expenseAllocation.findMany({
    where: { expense: { messId, monthId: month.id, status: { in: ["APPROVED", "REVERSED"] } } },
    select: { memberId: true, amountPoisha: true, expense: { select: { category: true, reversalOf: { select: { category: true } } } } },
  });

  const allocatedByMember = new Map<string, bigint>();
  for (const a of allocations) {
    const category = effectiveCategory(a.expense.category, a.expense.reversalOf?.category ?? null);
    if (category === MEAL_CATEGORY) continue;
    allocatedByMember.set(a.memberId, (allocatedByMember.get(a.memberId) ?? 0n) + a.amountPoisha);
  }

  const verifiedDepositsByMember = new Map<string, bigint>();
  let verifiedDeposits = 0n;
  let pendingDeposits = 0n;
  let verifiedCount = 0;
  let pendingCount = 0;
  const touchedMemberIds = new Set<string>();
  for (const d of deposits) {
    touchedMemberIds.add(d.memberId);
    if (d.status === "VERIFIED") {
      verifiedDeposits += d.amountPoisha;
      verifiedCount += 1;
      verifiedDepositsByMember.set(d.memberId, (verifiedDepositsByMember.get(d.memberId) ?? 0n) + d.amountPoisha);
    } else if (d.status === "PENDING") {
      pendingDeposits += d.amountPoisha;
      pendingCount += 1;
    }
  }

  const creditsByMember = new Map<string, bigint>();
  const debitsByMember = new Map<string, bigint>();
  for (const adj of adjustments) {
    touchedMemberIds.add(adj.memberId);
    const target = adj.type === "CREDIT" ? creditsByMember : debitsByMember;
    target.set(adj.memberId, (target.get(adj.memberId) ?? 0n) + adj.amountPoisha);
  }

  for (const c of mealCounts) touchedMemberIds.add(c.memberId);
  for (const memberId of allocatedByMember.keys()) touchedMemberIds.add(memberId);

  const memberRows = await db.messMembership.findMany({
    where: { messId, id: { in: [...touchedMemberIds] } },
    select: { id: true, role: true, status: true, displayName: true, user: { select: { name: true } } },
  });
  const memberInfo = new Map(memberRows.map((m) => [m.id, m]));

  const members: MemberBalanceRow[] = [];
  let totalMealCost = 0n;
  let totalAllocated = 0n;
  let totalBalance = 0n;
  let outstanding = 0n;
  let advance = 0n;

  for (const memberId of touchedMemberIds) {
    const info = memberInfo.get(memberId);
    if (!info) continue;
    const mealCount = mealCounts.find((c) => c.memberId === memberId)?.total ?? 0;
    const mealCost = mealRate * BigInt(mealCount);
    const allocated = allocatedByMember.get(memberId) ?? 0n;
    const verified = verifiedDepositsByMember.get(memberId) ?? 0n;
    const credits = creditsByMember.get(memberId) ?? 0n;
    const debits = debitsByMember.get(memberId) ?? 0n;
    const balance = verified - mealCost - allocated + credits - debits;

    totalMealCost += mealCost;
    totalAllocated += allocated;
    totalBalance += balance;
    if (balance < 0n) outstanding += -balance;
    else advance += balance;

    members.push({
      memberId,
      memberName: info.displayName ?? info.user?.name ?? null,
      role: info.role,
      status: info.status,
      mealCount,
      mealCostPoisha: mealCost.toString(),
      mealCostTaka: poishaToTakaString(mealCost),
      verifiedDepositsPoisha: verified.toString(),
      verifiedDepositsTaka: poishaToTakaString(verified),
      allocatedChargesPoisha: allocated.toString(),
      allocatedChargesTaka: poishaToTakaString(allocated),
      creditsPoisha: credits.toString(),
      debitsPoisha: debits.toString(),
      adjustmentsPoisha: (credits - debits).toString(),
      balancePoisha: balance.toString(),
      balanceTaka: poishaToTakaString(balance),
    });
  }
  members.sort((a, b) => a.memberName?.localeCompare(b.memberName ?? "") ?? 0);

  const closingCash = month.openingCashPoisha + verifiedDeposits - totalApproved;
  const budgetRemaining = month.budgetPoisha - totalApproved;
  const utilisation = month.budgetPoisha > 0n ? Number((totalApproved * 10000n) / month.budgetPoisha) / 100 : 0;

  return {
    month: {
      id: month.id,
      year: month.year,
      month: month.month,
      label: monthLabel(month.year, month.month),
      status: month.status,
      daysInMonth: daysInMonth(month.year, month.month),
    },
    meal: {
      totalMealCount,
      mealExpensePoisha: mealExpense.toString(),
      mealExpenseTaka: poishaToTakaString(mealExpense),
      mealRatePoisha: mealRate.toString(),
      mealRateTaka: poishaToTakaString(mealRate),
    },
    expenses: {
      totalApprovedPoisha: totalApproved.toString(),
      totalApprovedTaka: poishaToTakaString(totalApproved),
      approvedCount: expenses.filter((e) => e.status === "APPROVED" && !e.reversalOfId).length,
      pendingCount: expenses.filter((e) => e.status === "PENDING").length,
      rejectedCount: expenses.filter((e) => e.status === "REJECTED").length,
      byCategory: [...byCategoryMap.entries()]
        .map(([category, amountPoisha]) => ({
          category,
          amountPoisha: amountPoisha.toString(),
          amountTaka: poishaToTakaString(amountPoisha),
        }))
        .sort((a, b) => Number(BigInt(b.amountPoisha) - BigInt(a.amountPoisha))),
    },
    deposits: {
      verifiedTotalPoisha: verifiedDeposits.toString(),
      verifiedTotalTaka: poishaToTakaString(verifiedDeposits),
      pendingTotalPoisha: pendingDeposits.toString(),
      pendingTotalTaka: poishaToTakaString(pendingDeposits),
      verifiedCount,
      pendingCount,
    },
    cash: {
      openingCashPoisha: month.openingCashPoisha.toString(),
      openingCashTaka: poishaToTakaString(month.openingCashPoisha),
      confirmedInflowsPoisha: verifiedDeposits.toString(),
      approvedPaymentsPoisha: totalApproved.toString(),
      closingCashPoisha: closingCash.toString(),
      closingCashTaka: poishaToTakaString(closingCash),
    },
    budget: {
      budgetPoisha: month.budgetPoisha.toString(),
      budgetTaka: poishaToTakaString(month.budgetPoisha),
      spentPoisha: totalApproved.toString(),
      remainingPoisha: budgetRemaining.toString(),
      remainingTaka: poishaToTakaString(budgetRemaining),
      utilisationPercent: utilisation,
    },
    members,
    totals: {
      memberMealCostPoisha: totalMealCost.toString(),
      memberAllocatedPoisha: totalAllocated.toString(),
      memberBalancePoisha: totalBalance.toString(),
      outstandingPoisha: outstanding.toString(),
      advancePoisha: advance.toString(),
    },
    generatedAt: new Date().toISOString(),
  };
}

export interface MemberBalanceSummary {
  month: { id: string; label: string; status: string };
  members: MemberBalanceRow[];
  totals: { outstandingPoisha: string; advancePoisha: string; netPoisha: string };
}

/** Settlement view: who owes the mess and who the mess owes, for a month. */
export async function getMemberBalances(messId: string, query: MonthReportQuery): Promise<MemberBalanceSummary> {
  const report = await getMonthlyReport(messId, query);
  const net = BigInt(report.totals.outstandingPoisha) - BigInt(report.totals.advancePoisha);
  return {
    month: { id: report.month.id, label: report.month.label, status: report.month.status },
    members: report.members,
    totals: {
      outstandingPoisha: report.totals.outstandingPoisha,
      advancePoisha: report.totals.advancePoisha,
      netPoisha: net.toString(),
    },
  };
}

export interface MonthSummary {
  month: { id: string; label: string; status: string };
  totalMealCount: number;
  mealRatePoisha: string;
  mealRateTaka: string;
  verifiedDepositsPoisha: string;
  approvedExpensesPoisha: string;
  closingCashPoisha: string;
  budgetRemainingPoisha: string;
  pendingDepositsCount: number;
  pendingExpensesCount: number;
  activeMembersCount: number;
}

/** Compact figures for the dashboard month selector / summary cards. */
export async function getMonthSummary(messId: string, query: MonthReportQuery): Promise<MonthSummary> {
  const report = await getMonthlyReport(messId, query);
  const activeMembersCount = await db.messMembership.count({ where: { messId, status: "ACTIVE" } });
  return {
    month: { id: report.month.id, label: report.month.label, status: report.month.status },
    totalMealCount: report.meal.totalMealCount,
    mealRatePoisha: report.meal.mealRatePoisha,
    mealRateTaka: report.meal.mealRateTaka,
    verifiedDepositsPoisha: report.deposits.verifiedTotalPoisha,
    approvedExpensesPoisha: report.expenses.totalApprovedPoisha,
    closingCashPoisha: report.cash.closingCashPoisha,
    budgetRemainingPoisha: report.budget.remainingPoisha,
    pendingDepositsCount: report.deposits.pendingCount,
    pendingExpensesCount: report.expenses.pendingCount,
    activeMembersCount,
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Renders the monthly report as CSV (UTF-8 with BOM so Excel shows Bangla/taka
 * correctly). Pure function of the report so it is easy to test.
 */
export function monthlyReportToCsv(report: MonthlyReport): string {
  const lines: string[] = [];
  lines.push(csvRow([`Monthly report — ${report.month.label}`]));
  lines.push(csvRow([`Generated at`, report.generatedAt]));
  lines.push("");

  lines.push(csvRow(["Summary"]));
  lines.push(csvRow(["Total meal count", report.meal.totalMealCount]));
  lines.push(csvRow(["Meal expense (BDT)", report.meal.mealExpenseTaka]));
  lines.push(csvRow(["Meal rate (BDT/meal)", report.meal.mealRateTaka]));
  lines.push(csvRow(["Verified deposits (BDT)", report.deposits.verifiedTotalTaka]));
  lines.push(csvRow(["Pending deposits (BDT)", report.deposits.pendingTotalTaka]));
  lines.push(csvRow(["Approved expenses (BDT)", report.expenses.totalApprovedTaka]));
  lines.push(csvRow(["Opening cash (BDT)", report.cash.openingCashTaka]));
  lines.push(csvRow(["Closing cash (BDT)", report.cash.closingCashTaka]));
  lines.push(csvRow(["Budget (BDT)", report.budget.budgetTaka]));
  lines.push(csvRow(["Budget remaining (BDT)", report.budget.remainingTaka]));
  lines.push("");

  lines.push(csvRow(["Expenses by category"]));
  lines.push(csvRow(["Category", "Amount (BDT)"]));
  for (const row of report.expenses.byCategory) lines.push(csvRow([row.category, row.amountTaka]));
  lines.push("");

  lines.push(csvRow(["Member balances"]));
  lines.push(
    csvRow([
      "Member",
      "Role",
      "Meal count",
      "Meal cost (BDT)",
      "Deposits (BDT)",
      "Allocated charges (BDT)",
      "Adjustments (BDT)",
      "Balance (BDT)",
    ]),
  );
  for (const m of report.members) {
    lines.push(
      csvRow([
        m.memberName ?? m.memberId,
        m.role,
        m.mealCount,
        m.mealCostTaka,
        m.verifiedDepositsTaka,
        m.allocatedChargesTaka,
        poishaToTakaString(BigInt(m.adjustmentsPoisha)),
        m.balanceTaka,
      ]),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
