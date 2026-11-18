import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/app.ts";
import { db, disconnectDb } from "../../src/app/db/prisma.ts";
import { TestClient, signUp } from "../helpers/http.ts";

const run = Date.now();

const managerEmail = `sec.manager.${run}@example.com`;
const outsiderEmail = `sec.outsider.${run}@example.com`;
const memberEmail = `sec.member.${run}@example.com`;
const revokedTargetEmail = `sec.revoked.${run}@example.com`;
const expiredTargetEmail = `sec.expired.${run}@example.com`;

const messA = `SEC Mess A ${run}`;
const messB = `SEC Mess B ${run}`;

const app = createApp();

let manager: TestClient;
let outsider: TestClient;
let member: TestClient;
let messAId: string;
let messBId: string;
let managerMemberId: string;

beforeAll(async () => {
  manager = await signUp(app, managerEmail, "Manager");
  outsider = await signUp(app, outsiderEmail, "Outsider");
  member = await signUp(app, memberEmail, "Member");

  const a = await manager.post("/api/v1/messes", { name: messA, area: "Mirpur" });
  expect(a.status).toBe(201);
  messAId = a.body.data.id;

  const b = await outsider.post("/api/v1/messes", { name: messB, area: "Uttara" });
  expect(b.status).toBe(201);
  messBId = b.body.data.id;

  const members = await manager.get(`/api/v1/messes/${messAId}/members`);
  managerMemberId = members.body.data[0].id;
});

afterAll(async () => {
  // Deleting the mess cascades memberships, invitations and audit rows.
  await db.mess.deleteMany({ where: { name: { in: [messA, messB] } } });
  await db.user.deleteMany({
    where: { email: { in: [managerEmail, outsiderEmail, memberEmail, revokedTargetEmail, expiredTargetEmail] } },
  });
  await disconnectDb();
});

describe("tenant isolation", () => {
  it("lets a member read their own mess", async () => {
    const res = await manager.get(`/api/v1/messes/${messAId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(messAId);
  });

  it("rejects unauthenticated access", async () => {
    const anon = new TestClient(app, "anon");
    expect((await anon.get("/api/v1/messes")).status).toBe(401);
    expect((await anon.get(`/api/v1/messes/${messAId}/members`)).status).toBe(401);
  });

  it("hides another mess from the outsider (403, not 404)", async () => {
    const res = await outsider.get(`/api/v1/messes/${messAId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("blocks the outsider from every sub-resource of another mess", async () => {
    const paths = [
      ["get", `/api/v1/messes/${messAId}/members`],
      ["get", `/api/v1/messes/${messBId}/members`], // own mess, sanity
      ["get", `/api/v1/messes/${messAId}/invitations`],
    ] as const;

    expect((await outsider.get(paths[0][1])).status).toBe(403);
    expect((await outsider.get(paths[1][1])).status).toBe(200);
    expect((await outsider.get(paths[2][1])).status).toBe(403);

    expect((await outsider.post(`/api/v1/messes/${messAId}/invitations`, { email: revokedTargetEmail })).status).toBe(403);
    expect((await outsider.patch(`/api/v1/messes/${messAId}`, { name: "hijacked" })).status).toBe(403);
    expect((await outsider.del(`/api/v1/messes/${messAId}/members/${managerMemberId}`)).status).toBe(403);
  });

  it("does not leak another mess through the mess list", async () => {
    const res = await outsider.get("/api/v1/users/me/messes");
    expect(res.status).toBe(200);
    const ids: string[] = res.body.data.map((m: { messId: string }) => m.messId);
    expect(ids).toContain(messBId);
    expect(ids).not.toContain(messAId);
  });

  it("does not let the only active manager leave their mess", async () => {
    const leave = await outsider.del(`/api/v1/messes/${messBId}/members/me`);
    expect(leave.status).toBe(422);
    expect(leave.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect((await outsider.get(`/api/v1/messes/${messBId}`)).status).toBe(200);
  });

  it("generates a full monthly duty roster without timing out", async () => {
    const first = await manager.post(`/api/v1/messes/${messAId}/duties/generate`, { year: 2027, month: 1 });
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(31);
    expect(new Set(first.body.data.map((duty: { date: string }) => duty.date)).size).toBe(31);

    const second = await manager.post(`/api/v1/messes/${messAId}/duties/generate`, { year: 2027, month: 1 });
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(31);
  });
});

describe("role enforcement", () => {
  let memberMembershipId: string;

  beforeAll(async () => {
    const invite = await manager.post(`/api/v1/messes/${messAId}/invitations`, {
      email: memberEmail,
      role: "MEMBER",
    });
    expect(invite.status).toBe(201);

    const accept = await member.post(`/api/v1/invitations/${invite.body.data.token}/accept`);
    expect(accept.status).toBe(200);
    memberMembershipId = accept.body.data.membershipId;
  });

  it("stops a plain member from administering the mess", async () => {
    expect((await member.patch(`/api/v1/messes/${messAId}`, { name: "nope" })).status).toBe(403);
    expect((await member.post(`/api/v1/messes/${messAId}/invitations`, { email: revokedTargetEmail })).status).toBe(403);
    expect((await member.get(`/api/v1/messes/${messAId}/invitations`)).status).toBe(403);
    expect((await member.del(`/api/v1/messes/${messAId}/members/${managerMemberId}`)).status).toBe(403);
  });

  it("stops a plain member from escalating their own role", async () => {
    const res = await member.patch(`/api/v1/messes/${messAId}/members/${memberMembershipId}`, { role: "MANAGER" });
    expect(res.status).toBe(403);
  });

  it("never strands a mess without an active manager", async () => {
    const demote = await manager.patch(`/api/v1/messes/${messAId}/members/${managerMemberId}`, { role: "MEMBER" });
    expect(demote.status).toBe(422);
    expect(demote.body.error.code).toBe("BUSINESS_RULE_VIOLATION");

    const remove = await manager.del(`/api/v1/messes/${messAId}/members/${managerMemberId}`);
    expect(remove.status).toBe(422);

    // Promoting the member first makes the demotion legal.
    expect((await manager.patch(`/api/v1/messes/${messAId}/members/${memberMembershipId}`, { role: "MANAGER" })).status).toBe(200);
    expect((await manager.patch(`/api/v1/messes/${messAId}/members/${managerMemberId}`, { role: "MEMBER" })).status).toBe(200);
    // Restore for later assertions.
    await member.patch(`/api/v1/messes/${messAId}/members/${managerMemberId}`, { role: "MANAGER" });
  });

  it("lets a member leave without signing out and rejoin with a new invitation", async () => {
    const leave = await member.del(`/api/v1/messes/${messAId}/members/me`);
    expect(leave.status).toBe(200);
    expect(leave.body.data.status).toBe("REMOVED");
    expect((await member.get("/api/v1/users/me")).status).toBe(200);
    expect((await member.get(`/api/v1/messes/${messAId}`)).status).toBe(403);

    const invite = await manager.post(`/api/v1/messes/${messAId}/invitations`, {
      email: memberEmail,
      role: "MEMBER",
    });
    expect(invite.status).toBe(201);
    const accept = await member.post(`/api/v1/invitations/${invite.body.data.token}/accept`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.membershipId).toBe(leave.body.data.id);
  });
});

describe("invitation validity", () => {
  it("rejects an unknown token", async () => {
    const res = await manager.get(`/api/v1/invitations/${"x".repeat(40)}`);
    expect(res.status).toBe(404);
  });

  it("rejects a revoked invitation", async () => {
    const created = await manager.post(`/api/v1/messes/${messAId}/invitations`, { email: revokedTargetEmail });
    expect(created.status).toBe(201);
    const { id, token } = created.body.data as { id: string; token: string };

    expect((await manager.del(`/api/v1/messes/${messAId}/invitations/${id}`)).status).toBe(200);

    const preview = await manager.get(`/api/v1/invitations/${token}`);
    expect(preview.status).toBe(422);
    expect(preview.body.error.message).toMatch(/revoked/i);
  });

  it("rejects an expired invitation and marks it EXPIRED", async () => {
    const created = await manager.post(`/api/v1/messes/${messAId}/invitations`, { email: expiredTargetEmail });
    expect(created.status).toBe(201);
    const { id, token } = created.body.data as { id: string; token: string };

    await db.messInvitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const preview = await manager.get(`/api/v1/invitations/${token}`);
    expect(preview.status).toBe(422);
    expect(preview.body.error.message).toMatch(/expired/i);

    const stored = await db.messInvitation.findUnique({ where: { id }, select: { status: true } });
    expect(stored?.status).toBe("EXPIRED");
  });

  it("refuses acceptance by an account the invitation was not addressed to", async () => {
    const created = await manager.post(`/api/v1/messes/${messAId}/invitations`, { email: revokedTargetEmail });
    const token = created.body.data.token as string;

    const res = await outsider.post(`/api/v1/invitations/${token}/accept`);
    expect(res.status).toBe(403);
  });

  it("refuses a duplicate pending invitation for the same target", async () => {
    const first = await manager.post(`/api/v1/messes/${messAId}/invitations`, { email: expiredTargetEmail });
    // expiredTargetEmail already has an EXPIRED invitation, so this must succeed…
    expect(first.status).toBe(201);
    // …but a second PENDING one for the same address must not.
    const second = await manager.post(`/api/v1/messes/${messAId}/invitations`, { email: expiredTargetEmail });
    expect(second.status).toBe(409);
  });
});
