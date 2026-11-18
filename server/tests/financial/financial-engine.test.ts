import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/app.ts";
import { db, disconnectDb } from "../../src/app/db/prisma.ts";
import { TestClient, signUp } from "../helpers/http.ts";

/**
 * Integration tests for the Phase 4 financial engine.
 *
 * A mess is set up with 3 members over a 31-day month (2026-12) where only
 * DINNER is enabled, so each member has exactly 31 meals and the mess has 93.
 * With a ৳9,300 meal-bazar expense the meal rate is exactly ৳100/meal, which
 * makes every downstream figure easy to verify by hand.
 */

const run = Date.now();
const YEAR = 2026;
const MONTH = 12; // 31 days
const DAYS = 31;

const managerEmail = `fin.manager.${run}@example.com`;
const memberBEmail = `fin.memberb.${run}@example.com`;
const memberCEmail = `fin.memberc.${run}@example.com`;
const counterEmail = `fin.counter.${run}@example.com`;
const messName = `FIN Mess ${run}`;

const app = createApp();

let manager: TestClient;
let messId: string;
let monthId: string;
let managerUserId: string;
let memberAId: string;
let memberBId: string;
let memberCId: string;
let mealExpenseId: string;

async function createAndApprove(client: TestClient, body: Record<string, unknown>): Promise<string> {
  const created = await client.post(`/api/v1/messes/${messId}/expenses`, { monthId, ...body });
  expect(created.status).toBe(201);
  const id = created.body.data.id as string;
  const approved = await client.post(`/api/v1/messes/${messId}/expenses/${id}/approve`);
  expect(approved.status).toBe(200);
  return id;
}

async function createDeposit(client: TestClient, memberId: string, amountTaka: string): Promise<string> {
  const created = await client.post(`/api/v1/messes/${messId}/deposits`, {
    monthId,
    memberId,
    amountTaka,
    method: "CASH",
  });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}

beforeAll(async () => {
  manager = await signUp(app, managerEmail, "Finance Manager");
  await signUp(app, memberBEmail, "Member B");
  await signUp(app, memberCEmail, "Member C");

  const mess = await manager.post("/api/v1/messes", { name: messName, area: "Dhanmondi" });
  expect(mess.status).toBe(201);
  messId = mess.body.data.id;

  const profile = await manager.get("/api/v1/users/me");
  managerUserId = profile.body.data.id;

  const members = await manager.get(`/api/v1/messes/${messId}/members`);
  memberAId = members.body.data[0].id;

  // Two further members join directly; the financial engine only reads ACTIVE
  // memberships, and the membership/invitation flow is covered elsewhere.
  const joinedAt = new Date(Date.UTC(YEAR, MONTH - 2, 1)); // 1 Nov — before the month
  const bUser = await db.user.findUniqueOrThrow({ where: { email: memberBEmail }, select: { id: true } });
  const cUser = await db.user.findUniqueOrThrow({ where: { email: memberCEmail }, select: { id: true } });
  memberBId = (
    await db.messMembership.create({
      data: { messId, userId: bUser.id, role: "MEMBER", status: "ACTIVE", displayName: "Member B", joinedAt },
    })
  ).id;
  memberCId = (
    await db.messMembership.create({
      data: { messId, userId: cUser.id, role: "MEMBER", status: "ACTIVE", displayName: "Member C", joinedAt },
    })
  ).id;

  const month = await manager.post(`/api/v1/messes/${messId}/months`, {
    year: YEAR,
    month: MONTH,
    openingCashTaka: "10000",
    budgetTaka: "50000",
    mealSettings: [
      { mealType: "BREAKFAST", enabled: false },
      { mealType: "LUNCH", enabled: false },
      { mealType: "DINNER", enabled: true },
    ],
  });
  expect(month.status).toBe(201);
  monthId = month.body.data.id;

  await db.mealRecord.createMany({
    data: [memberAId, memberBId, memberCId].flatMap((memberId) =>
      Array.from({ length: DAYS }, (_, index) => ({
        messId,
        monthId,
        memberId,
        date: new Date(Date.UTC(YEAR, MONTH - 1, index + 1)),
        mealType: "DINNER" as const,
        status: "ON" as const,
        changedById: managerUserId,
        changedAt: new Date(),
      })),
    ),
  });

  // Approved meal-bazar expense: ৳9,300 over 93 meals → meal rate ৳100.
  mealExpenseId = await createAndApprove(manager, {
    category: "MEAL_BAZAR",
    amountTaka: "9300",
    description: "Monthly bazar",
    allocationMethod: "EQUAL",
    incurredOn: `${YEAR}-12-05`,
  });

  // Approved shared expense, split equally across the 3 members.
  await createAndApprove(manager, {
    category: "RENT",
    amountTaka: "31000",
    description: "December rent",
    allocationMethod: "EQUAL",
    incurredOn: `${YEAR}-12-01`,
  });

  // A pending expense (must be excluded) …
  const pending = await manager.post(`/api/v1/messes/${messId}/expenses`, {
    monthId,
    category: "ELECTRICITY",
    amountTaka: "2000",
    description: "Pending electricity bill",
    allocationMethod: "EQUAL",
    incurredOn: `${YEAR}-12-10`,
  });
  expect(pending.status).toBe(201);

  // … and a rejected expense (must be excluded).
  const rejected = await manager.post(`/api/v1/messes/${messId}/expenses`, {
    monthId,
    category: "WIFI",
    amountTaka: "1000",
    description: "Duplicate wifi bill",
    allocationMethod: "EQUAL",
    incurredOn: `${YEAR}-12-11`,
  });
  const rejectedId = rejected.body.data.id as string;
  const rejectedRes = await manager.post(`/api/v1/messes/${messId}/expenses/${rejectedId}/reject`, {
    reason: "Duplicate entry",
  });
  expect(rejectedRes.status).toBe(200);

  // Deposits: two verified, one pending.
  const depositA = await createDeposit(manager, memberAId, "20000");
  expect((await manager.post(`/api/v1/messes/${messId}/deposits/${depositA}/verify`)).status).toBe(200);

  const depositB = await createDeposit(manager, memberBId, "20000");
  expect((await manager.post(`/api/v1/messes/${messId}/deposits/${depositB}/verify`)).status).toBe(200);

  await createDeposit(manager, memberCId, "5000"); // left PENDING

  // A member credit adjustment (no HTTP route yet — written directly).
  await db.memberAdjustment.create({
    data: {
      messId,
      monthId,
      memberId: memberBId,
      type: "CREDIT",
      amountPoisha: 50_000n, // ৳500
      reason: "Advance carried over from November",
      createdById: managerUserId,
    },
  });
});

afterAll(async () => {
  // Financial rows use Restrict on MessMonth/MessMembership, so delete children
  // first, then the month and memberships, then the mess and users.
  await db.expense.deleteMany({ where: { messId } }); // cascades allocations
  await db.deposit.deleteMany({ where: { messId } });
  await db.memberAdjustment.deleteMany({ where: { messId } });
  await db.mealRecord.deleteMany({ where: { messId } });
  await db.dailyMenu.deleteMany({ where: { messId } });
  await db.messMonth.deleteMany({ where: { messId } });
  await db.messMembership.deleteMany({ where: { messId } });
  await db.mess.deleteMany({ where: { id: messId } });
  await db.user.deleteMany({ where: { email: { in: [managerEmail, memberBEmail, memberCEmail, counterEmail] } } });
  await disconnectDb();
});

describe("financial engine — monthly report", () => {
  it("counts 93 meals and derives the meal rate from approved meal expenses", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.meal.totalMealCount).toBe(3 * DAYS);
    expect(res.body.data.meal.mealExpensePoisha).toBe("930000");
    expect(res.body.data.meal.mealRatePoisha).toBe("10000");
    expect(res.body.data.meal.mealRateTaka).toBe("100.00");
  });

  it("includes approved expenses and excludes pending/rejected ones", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    const data = res.body.data;
    expect(data.expenses.totalApprovedPoisha).toBe("4030000"); // 9,300 + 31,000
    expect(data.expenses.approvedCount).toBe(2);
    expect(data.expenses.pendingCount).toBe(1);
    expect(data.expenses.rejectedCount).toBe(1);

    const byCategory = Object.fromEntries(
      (data.expenses.byCategory as { category: string; amountPoisha: string }[]).map((c) => [c.category, c.amountPoisha]),
    );
    expect(byCategory.MEAL_BAZAR).toBe("930000");
    expect(byCategory.RENT).toBe("3100000");
  });

  it("counts only verified deposits, showing pending separately", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    expect(res.body.data.deposits.verifiedTotalPoisha).toBe("4000000");
    expect(res.body.data.deposits.verifiedCount).toBe(2);
    expect(res.body.data.deposits.pendingTotalPoisha).toBe("500000");
    expect(res.body.data.deposits.pendingCount).toBe(1);
  });

  it("keeps closing cash and budget remaining as two different figures", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    const data = res.body.data;
    // Closing cash = opening + confirmed inflows − approved payments
    expect(data.cash.openingCashPoisha).toBe("1000000");
    expect(data.cash.closingCashPoisha).toBe("970000"); // 10,000 + 40,000 − 40,300
    // Budget remaining = budget − approved expenses
    expect(data.budget.budgetPoisha).toBe("5000000");
    expect(data.budget.remainingPoisha).toBe("970000"); // coincidentally equal here
    expect(data.budget.utilisationPercent).toBeCloseTo(80.6, 1);
  });

  it("reconciles every member balance with the ledger", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    const data = res.body.data;
    const members = data.members as {
      memberId: string;
      mealCount: number;
      mealCostPoisha: string;
      verifiedDepositsPoisha: string;
      allocatedChargesPoisha: string;
      creditsPoisha: string;
      debitsPoisha: string;
      balancePoisha: string;
    }[];

    expect(members).toHaveLength(3);
    for (const m of members) {
      expect(m.mealCount).toBe(DAYS); // every member ate all 31 dinners
      expect(m.mealCostPoisha).toBe("310000"); // 31 × ৳100
      const expected =
        BigInt(m.verifiedDepositsPoisha) -
        BigInt(m.mealCostPoisha) -
        BigInt(m.allocatedChargesPoisha) +
        BigInt(m.creditsPoisha) -
        BigInt(m.debitsPoisha);
      expect(m.balancePoisha).toBe(expected.toString());
    }

    // Meal cost reconciles to the meal-bazar expense; allocations reconcile to rent.
    expect(data.totals.memberMealCostPoisha).toBe("930000");
    expect(data.totals.memberAllocatedPoisha).toBe("3100000");

    // Sum of individual balances equals the reported total.
    const sum = members.reduce((acc, m) => acc + BigInt(m.balancePoisha), 0n);
    expect(sum.toString()).toBe(data.totals.memberBalancePoisha);
    // 40,000 deposits − 9,300 meal cost − 31,000 allocated rent + 500 credit = 200
    expect(data.totals.memberBalancePoisha).toBe("20000");

    // outstanding (negative balances) and advance (positive balances)
    expect(data.totals.outstandingPoisha).toBe("1343333");
    expect(data.totals.advancePoisha).toBe("1363333");
  });

  it("returns an exact settlement split via the balances endpoint", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/balances?monthId=${monthId}`);
    expect(res.status).toBe(200);
    const { members, totals } = res.body.data;
    expect(members).toHaveLength(3);
    expect(totals.outstandingPoisha).toBe("1343333");
    expect(totals.advancePoisha).toBe("1363333");
    // net = outstanding − advance
    expect(totals.netPoisha).toBe("-20000");
  });

  it("exposes a compact summary for dashboards", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/summary?monthId=${monthId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalMealCount: 93,
      mealRatePoisha: "10000",
      verifiedDepositsPoisha: "4000000",
      approvedExpensesPoisha: "4030000",
      closingCashPoisha: "970000",
      pendingDepositsCount: 1,
      pendingExpensesCount: 1,
      activeMembersCount: 3,
    });
  });

  it("exports the report as CSV with a BOM", async () => {
    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly.csv?monthId=${monthId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text.startsWith("\uFEFF")).toBe(true);
    expect(res.text).toContain("Meal rate (BDT/meal),100.00");
    expect(res.text).toContain("Member B");
  });
});

describe("financial engine — reversals", () => {
  it("nets a reversed expense to zero instead of double-subtracting", async () => {
    const reversed = await manager.post(`/api/v1/messes/${messId}/expenses/${mealExpenseId}/reverse`, {
      reason: "Bazar was refunded",
    });
    expect(reversed.status).toBe(200);

    const res = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    const data = res.body.data;

    // The meal expense is gone, so the meal rate collapses to zero …
    expect(data.meal.mealExpensePoisha).toBe("0");
    expect(data.meal.mealRatePoisha).toBe("0");
    expect(data.totals.memberMealCostPoisha).toBe("0");

    // … and only the reversal is left in the ledger (rent stays approved).
    expect(data.expenses.totalApprovedPoisha).toBe("3100000");
    expect(data.expenses.approvedCount).toBe(1);

    // The refund is not surfaced as a separate "other" category.
    const categories = (data.expenses.byCategory as { category: string }[]).map((c) => c.category);
    expect(categories).not.toContain("REFUND_ADJUSTMENT");

    // Refund returned cash: closing = 10,000 + 40,000 − 31,000.
    expect(data.cash.closingCashPoisha).toBe("1900000");
    expect(data.budget.remainingPoisha).toBe("1900000");
  });

  it("refuses to reverse an already-reversed expense", async () => {
    const again = await manager.post(`/api/v1/messes/${messId}/expenses/${mealExpenseId}/reverse`, {
      reason: "Trying again",
    });
    expect(again.status).toBe(422);
  });
});

describe("meal selections and month close", () => {
  it("starts at zero, supports manager corrections, and finalizes the meal report on close", async () => {
    const newMember = await signUp(app, counterEmail, "Counter Member");
    const profile = await newMember.get("/api/v1/users/me");
    const month = await manager.post(`/api/v1/messes/${messId}/months`, { year: 2027, month: 1 });
    expect(month.status).toBe(201);
    const counterMonthId = month.body.data.id as string;
    await db.mealTypeSetting.updateMany({
      where: { monthId: counterMonthId },
      data: { defaultOn: true },
    });
    const membership = await db.messMembership.create({
      data: {
        messId,
        userId: profile.body.data.id,
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: new Date(Date.UTC(2027, 0, 15, 12)),
      },
    });

    const countsPath = `/api/v1/messes/${messId}/meals/counts?monthId=${counterMonthId}`;
    const initialCounts = await manager.get(countsPath);
    expect(initialCounts.status).toBe(200);
    expect(initialCounts.body.data.find((row: { memberId: string }) => row.memberId === membership.id).total).toBe(0);

    const changeMeal = (status: "ON" | "OFF") =>
      manager.post(`/api/v1/messes/${messId}/meals/records/override`, {
        memberId: membership.id,
        date: "2027-01-15",
        mealType: "DINNER",
        status,
        reason: "Manager meal correction",
      });

    expect((await changeMeal("ON")).status).toBe(200);
    expect((await manager.get(countsPath)).body.data.find((row: { memberId: string }) => row.memberId === membership.id).total).toBe(1);
    expect((await changeMeal("OFF")).status).toBe(200);
    expect((await manager.get(countsPath)).body.data.find((row: { memberId: string }) => row.memberId === membership.id).total).toBe(0);
    expect((await changeMeal("ON")).status).toBe(200);

    const expense = await manager.post(`/api/v1/messes/${messId}/expenses`, {
      monthId: counterMonthId,
      category: "MEAL_BAZAR",
      amountTaka: "250",
      description: "January meal cost",
      allocationMethod: "EQUAL",
      incurredOn: "2027-01-15",
    });
    expect(expense.status).toBe(201);
    expect((await manager.post(`/api/v1/messes/${messId}/expenses/${expense.body.data.id}/approve`)).status).toBe(200);

    const close = await manager.post(`/api/v1/messes/${messId}/months/${counterMonthId}/close`);
    expect(close.status).toBe(200);
    const reverse = await manager.post(`/api/v1/messes/${messId}/expenses/${expense.body.data.id}/reverse`, {
      reason: "Month already closed",
    });
    expect(reverse.status).toBe(422);

    const report = await manager.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${counterMonthId}`);
    expect(report.status).toBe(200);
    expect(report.body.data.meal).toMatchObject({ totalMealCount: 1, mealRatePoisha: "25000" });
    expect(report.body.data.members.find((row: { memberId: string }) => row.memberId === membership.id)).toMatchObject({
      mealCount: 1,
      mealCostPoisha: "25000",
    });
    expect((await changeMeal("OFF")).status).toBe(422);
  }, 60000);
});

describe("financial engine — authorisation", () => {
  it("blocks a member from reading the report of a mess they do not belong to", async () => {
    const outsider = await signUp(app, `fin.outsider.${run}@example.com`, "Outsider");
    const res = await outsider.get(`/api/v1/messes/${messId}/reports/monthly?monthId=${monthId}`);
    expect(res.status).toBe(403);
    await db.user.deleteMany({ where: { email: `fin.outsider.${run}@example.com` } });
  });

  it("rejects an unknown month with 404", async () => {
    const res = await manager.get(
      `/api/v1/messes/${messId}/reports/monthly?monthId=00000000-0000-4000-8000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});
