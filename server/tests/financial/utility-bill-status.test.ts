import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/app.ts";
import { db, disconnectDb } from "../../src/app/db/prisma.ts";
import { TestClient, signUp } from "../helpers/http.ts";

const run = Date.now();
const managerEmail = `utility.manager.${run}@example.com`;
const secondManagerEmail = `utility.manager.second.${run}@example.com`;
const memberEmail = `utility.member.${run}@example.com`;
const app = createApp();

let manager: TestClient;
let secondManager: TestClient;
let member: TestClient;
let messId: string;
let monthId: string;
let expenseId: string;
let managerUserId: string;

beforeAll(async () => {
  manager = await signUp(app, managerEmail, "Utility Manager");
  secondManager = await signUp(app, secondManagerEmail, "Second Utility Manager");
  member = await signUp(app, memberEmail, "Utility Member");

  const mess = await manager.post("/api/v1/messes", { name: `Utility Mess ${run}` });
  expect(mess.status).toBe(201);
  messId = mess.body.data.id as string;
  managerUserId = (await manager.get("/api/v1/users/me")).body.data.id as string;

  const memberUser = await db.user.findUniqueOrThrow({ where: { email: memberEmail }, select: { id: true } });
  const secondManagerUser = await db.user.findUniqueOrThrow({
    where: { email: secondManagerEmail },
    select: { id: true },
  });
  await db.messMembership.create({
    data: {
      messId,
      userId: memberUser.id,
      role: "MEMBER",
      status: "ACTIVE",
      displayName: "Utility Member",
    },
  });
  await db.messMembership.create({
    data: {
      messId,
      userId: secondManagerUser.id,
      role: "MANAGER",
      status: "ACTIVE",
      displayName: "Second Utility Manager",
    },
  });

  const month = await manager.post(`/api/v1/messes/${messId}/months`, { year: 2026, month: 12 });
  expect(month.status).toBe(201);
  monthId = month.body.data.id as string;

  const expense = await manager.post(`/api/v1/messes/${messId}/expenses`, {
    monthId,
    category: "WATER",
    amountTaka: "1200",
    description: "December water bill",
    allocationMethod: "EQUAL",
    incurredOn: "2026-12-01",
  });
  expect(expense.status).toBe(201);
  expenseId = expense.body.data.id as string;
  expect((await manager.post(`/api/v1/messes/${messId}/expenses/${expenseId}/approve`)).status).toBe(200);
});

afterAll(async () => {
  if (messId) {
    await db.expense.deleteMany({ where: { messId } });
    await db.deposit.deleteMany({ where: { messId } });
    await db.memberAdjustment.deleteMany({ where: { messId } });
    await db.messMonth.deleteMany({ where: { messId } });
    await db.messMembership.deleteMany({ where: { messId } });
    await db.mess.deleteMany({ where: { id: messId } });
  }
  await db.user.deleteMany({ where: { email: { in: [managerEmail, secondManagerEmail, memberEmail] } } });
  await disconnectDb();
});

describe("utility bill paid status", () => {
  it("allows only the bill creator to delete utility bills without provider or member payments", async () => {
    const pending = await manager.post(`/api/v1/messes/${messId}/expenses`, {
      monthId,
      category: "GAS",
      amountTaka: "150",
      description: "Pending gas bill to delete",
      allocationMethod: "EQUAL",
      incurredOn: "2026-12-01",
    });
    expect(pending.status).toBe(201);
    const pendingId = pending.body.data.id as string;

    const otherManagerDelete = await secondManager.del(`/api/v1/messes/${messId}/utilities/${pendingId}`);
    expect(otherManagerDelete.status).toBe(403);

    const deleted = await manager.del(`/api/v1/messes/${messId}/utilities/${pendingId}`);
    expect(deleted.status).toBe(200);
    expect(await db.expense.findUnique({ where: { id: pendingId } })).toBeNull();

    const approvedWithoutPayments = await manager.post(`/api/v1/messes/${messId}/expenses`, {
      monthId,
      category: "WATER",
      amountTaka: "180",
      description: "Approved water bill to delete",
      allocationMethod: "EQUAL",
      incurredOn: "2026-12-01",
    });
    expect(approvedWithoutPayments.status).toBe(201);
    const approvedWithoutPaymentsId = approvedWithoutPayments.body.data.id as string;
    expect((await manager.post(`/api/v1/messes/${messId}/expenses/${approvedWithoutPaymentsId}/approve`)).status).toBe(200);
    expect((await manager.del(`/api/v1/messes/${messId}/utilities/${approvedWithoutPaymentsId}`)).status).toBe(200);
    expect(await db.expense.findUnique({ where: { id: approvedWithoutPaymentsId } })).toBeNull();

    const approved = await manager.post(`/api/v1/messes/${messId}/expenses`, {
      monthId,
      category: "GAS",
      amountTaka: "250",
      description: "Gas bill with payment request",
      allocationMethod: "EQUAL",
      incurredOn: "2026-12-01",
    });
    expect(approved.status).toBe(201);
    const approvedId = approved.body.data.id as string;
    expect((await manager.post(`/api/v1/messes/${messId}/expenses/${approvedId}/approve`)).status).toBe(200);
    expect((await member.post(`/api/v1/messes/${messId}/utilities/${approvedId}/payments`, { method: "CASH" })).status).toBe(200);

    const protectedDelete = await manager.del(`/api/v1/messes/${messId}/utilities/${approvedId}`);
    expect(protectedDelete.status).toBe(409);
    expect(await db.expense.findUnique({ where: { id: approvedId } })).not.toBeNull();
    await db.expense.delete({ where: { id: approvedId } });
  });

  it("lets a manager toggle a bill paid/not paid and only exposes each member's own share", async () => {
    const memberView = await member.get(`/api/v1/messes/${messId}/utilities?monthId=${monthId}`);
    expect(memberView.status).toBe(200);
    expect(memberView.body.data).toHaveLength(1);
    expect(memberView.body.data[0].shares).toHaveLength(1);
    expect(memberView.body.data[0].utilityBillPaid).toBe(false);

    const request = await member.post(`/api/v1/messes/${messId}/utilities/${expenseId}/payments`, { method: "CASH" });
    expect(request.status).toBe(200);

    const forbidden = await member.patch(`/api/v1/messes/${messId}/utilities/${expenseId}/payment-status`, { paid: true });
    expect(forbidden.status).toBe(403);

    const paid = await manager.patch(`/api/v1/messes/${messId}/utilities/${expenseId}/payment-status`, { paid: true });
    expect(paid.status).toBe(200);
    expect(paid.body.data).toMatchObject({ id: expenseId, paid: true, paidById: managerUserId });
    expect(paid.body.data.paidAt).toBeTruthy();

    const memberAfterProviderPayment = await member.get(`/api/v1/messes/${messId}/utilities?monthId=${monthId}`);
    expect(memberAfterProviderPayment.body.data[0].utilityBillPaid).toBe(true);
    expect(memberAfterProviderPayment.body.data[0].shares[0].payment.status).toBe("PENDING");

    const notPaid = await manager.patch(`/api/v1/messes/${messId}/utilities/${expenseId}/payment-status`, { paid: false });
    expect(notPaid.status).toBe(200);
    expect(notPaid.body.data).toMatchObject({ id: expenseId, paid: false, paidById: null, paidAt: null });
    const memberAfterProviderUnpaid = await member.get(`/api/v1/messes/${messId}/utilities?monthId=${monthId}`);
    expect(memberAfterProviderUnpaid.body.data[0].utilityBillPaid).toBe(false);
    expect(memberAfterProviderUnpaid.body.data[0].shares[0].payment.status).toBe("PENDING");
  });
}, 60000);
