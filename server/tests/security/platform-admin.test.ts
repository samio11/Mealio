import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/app.ts";
import { db, disconnectDb } from "../../src/app/db/prisma.ts";
import { TestClient, signUp } from "../helpers/http.ts";

const run = Date.now();
const adminEmail = `platform.admin.${run}@example.com`;
const userEmail = `platform.user.${run}@example.com`;
const messName = `Platform admin mess ${run}`;
const recreatedMessName = `Recreated mess ${run}`;
const membershipMessName = `Membership mess ${run}`;
const app = createApp();

let admin: TestClient;
let user: TestClient;
let messId: string;

beforeAll(async () => {
  admin = await signUp(app, adminEmail, "Platform Admin");
  await db.user.update({ where: { email: adminEmail }, data: { platformRole: "ADMIN" } });
  user = await signUp(app, userEmail, "Platform User");

  const created = await admin.post("/api/v1/messes", { name: messName, area: "Mirpur" });
  expect(created.status).toBe(201);
  messId = created.body.data.id as string;
  const month = await admin.post(`/api/v1/messes/${messId}/months`, { year: 2030, month: 1 });
  expect(month.status).toBe(201);
  const userId = (await db.user.findUniqueOrThrow({ where: { email: userEmail } })).id;
  await db.messMembership.create({
    data: { messId, userId, role: "MEMBER", status: "ACTIVE" },
  });
});

afterAll(async () => {
  for (const name of [recreatedMessName, membershipMessName]) {
    const mess = await db.mess.findFirst({ where: { name }, select: { id: true } });
    if (mess && admin) {
      const deleted = await admin.del(`/api/v1/admin/messes/${mess.id}`, { confirmationName: name });
      if (deleted.status !== 200) throw new Error(`Could not clean up test mess ${name}: ${deleted.status}`);
    }
  }
  await db.mess.deleteMany({ where: { name: messName } });
  await db.user.deleteMany({ where: { email: { in: [adminEmail, userEmail] } } });
  await disconnectDb();
});

describe("platform administration", () => {
  it("protects the API, manages users, inspects messes and confirms permanent deletion", async () => {
    const anonymous = new TestClient(app, "anonymous");
    expect((await anonymous.get("/api/v1/admin/overview")).status).toBe(401);
    expect((await user.get("/api/v1/admin/overview")).status).toBe(403);

    const overview = await admin.get("/api/v1/admin/overview");
    expect(overview.status).toBe(200);
    expect(overview.body.data.users).toBeGreaterThanOrEqual(2);
    expect(overview.body.data.messes).toBeGreaterThanOrEqual(1);

    const users = await admin.get(`/api/v1/admin/users?q=${encodeURIComponent(userEmail)}`);
    expect(users.status).toBe(200);
    expect(users.body.data.some((item: { email: string }) => item.email === userEmail)).toBe(true);

    const role = await admin.patch(`/api/v1/admin/users/${(await db.user.findUniqueOrThrow({ where: { email: userEmail } })).id}/role`, {
      platformRole: "ADMIN",
    });
    expect(role.status).toBe(200);
    expect(role.body.data.platformRole).toBe("ADMIN");
    expect((await user.get("/api/v1/admin/overview")).status).toBe(200);

    const demotion = await admin.patch(`/api/v1/admin/users/${(await db.user.findUniqueOrThrow({ where: { email: userEmail } })).id}/role`, {
      platformRole: "USER",
    });
    expect(demotion.status).toBe(200);
    expect((await user.get("/api/v1/admin/overview")).status).toBe(403);

    const userId = (await db.user.findUniqueOrThrow({ where: { email: userEmail } })).id;
    const blocked = await admin.patch(`/api/v1/admin/users/${userId}/block`, { blocked: true });
    expect(blocked.status).toBe(200);
    expect(blocked.body.data.blockedAt).toBeTruthy();
    expect((await user.get("/api/v1/users/me")).status).toBe(401);

    const blockedSignIn = await user.post("/api/auth/sign-in/email", {
      email: userEmail,
      password: "Passw0rd!23",
    });
    expect(blockedSignIn.status).not.toBe(200);
    expect((await user.get("/api/v1/users/me")).status).not.toBe(200);

    const unblocked = await admin.patch(`/api/v1/admin/users/${userId}/block`, { blocked: false });
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.data.blockedAt).toBeNull();
    expect((await user.post("/api/auth/sign-in/email", {
      email: userEmail,
      password: "Passw0rd!23",
    })).status).toBe(200);
    expect((await user.get("/api/v1/users/me")).status).toBe(200);

    const adminId = (await db.user.findUniqueOrThrow({ where: { email: adminEmail } })).id;
    const selfDemotion = await admin.patch(`/api/v1/admin/users/${adminId}/role`, { platformRole: "USER" });
    expect(selfDemotion.status).toBe(422);
    expect((await db.user.findUniqueOrThrow({ where: { id: adminId } })).platformRole).toBe("ADMIN");
    const selfBlock = await admin.patch(`/api/v1/admin/users/${adminId}/block`, { blocked: true });
    expect(selfBlock.status).toBe(422);

    const mess = await admin.get(`/api/v1/admin/messes/${messId}`);
    expect(mess.status).toBe(200);
    expect(mess.body.data.name).toBe(messName);
    expect(mess.body.data.memberships).toHaveLength(2);
    expect(mess.body.data.months.length).toBeGreaterThan(0);

    const mismatch = await admin.del(`/api/v1/admin/messes/${messId}`, { confirmationName: "Not the mess name" });
    expect(mismatch.status).toBe(400);
    expect((await db.mess.findUnique({ where: { id: messId } }))?.name).toBe(messName);

    const deleted = await admin.del(`/api/v1/admin/messes/${messId}`, { confirmationName: messName });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toMatchObject({
      id: messId,
      name: messName,
      deleted: true,
      storageCleanupFailures: 0,
    });
    expect(await db.mess.findUnique({ where: { id: messId } })).toBeNull();
    expect(await db.messMembership.count({ where: { messId } })).toBe(0);
    expect(await db.user.findUnique({ where: { email: adminEmail } })).not.toBeNull();

    const recreated = await user.post("/api/v1/messes", { name: recreatedMessName, area: "Uttara" });
    expect(recreated.status).toBe(201);
    expect(recreated.body.data).toMatchObject({ name: recreatedMessName, myRole: "MANAGER" });
    const recreatedId = recreated.body.data.id as string;
    expect(await db.messMembership.findUnique({
      where: { messId_userId: { messId: recreatedId, userId } },
    })).toMatchObject({ role: "MANAGER", status: "ACTIVE" });

    const membershipMess = await admin.post("/api/v1/messes", { name: membershipMessName, area: "Banani" });
    expect(membershipMess.status).toBe(201);
    const membershipMessId = membershipMess.body.data.id as string;
    await db.messMembership.create({
      data: { messId: membershipMessId, userId, role: "MEMBER", status: "ACTIVE" },
    });

    const wrongEmail = await admin.del(`/api/v1/admin/users/${userId}`, { confirmationEmail: "wrong@example.com" });
    expect(wrongEmail.status).toBe(400);
    expect(await db.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(await db.mess.findUnique({ where: { id: recreatedId } })).not.toBeNull();

    const selfDelete = await admin.del(`/api/v1/admin/users/${adminId}`, { confirmationEmail: adminEmail });
    expect(selfDelete.status).toBe(422);
    expect(await db.user.findUnique({ where: { id: adminId } })).not.toBeNull();

    const userDeleted = await admin.del(`/api/v1/admin/users/${userId}`, { confirmationEmail: userEmail });
    expect(userDeleted.status).toBe(200);
    expect(userDeleted.body.data).toMatchObject({
      id: userId,
      deleted: true,
      deletedMesses: 2,
      storageCleanupFailures: 0,
    });
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await db.mess.findUnique({ where: { id: recreatedId } })).toBeNull();
    expect(await db.mess.findUnique({ where: { id: membershipMessId } })).toBeNull();
    expect((await user.get("/api/v1/users/me")).status).toBe(401);
  }, 90_000);
});
