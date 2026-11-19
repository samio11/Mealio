import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/app.ts";
import { db, disconnectDb } from "../../src/app/db/prisma.ts";
import { TestClient, signUp } from "../helpers/http.ts";

const run = Date.now();
const managerEmail = `whatsapp.manager.${run}@example.com`;
const memberEmail = `whatsapp.member.${run}@example.com`;
const managerPhone = `017${String(run % 100_000_000).padStart(8, "0")}`;
const memberPhone = `018${String((run + 1) % 100_000_000).padStart(8, "0")}`;
const app = createApp();

let manager: TestClient;
let member: TestClient;
let messId: string;

beforeAll(async () => {
  manager = await signUp(app, managerEmail, "WhatsApp Manager");
  member = await signUp(app, memberEmail, "WhatsApp Member");

  const mess = await manager.post("/api/v1/messes", { name: `WhatsApp Mess ${run}` });
  expect(mess.status).toBe(201);
  messId = mess.body.data.id as string;

  const memberUser = await db.user.findUniqueOrThrow({ where: { email: memberEmail }, select: { id: true } });
  await db.messMembership.create({
    data: {
      messId,
      userId: memberUser.id,
      role: "MEMBER",
      status: "ACTIVE",
      displayName: "WhatsApp Member",
    },
  });

  const managerPhoneInput = `00880${managerPhone.slice(1)}`;
  const managerProfile = await manager.patch("/api/v1/users/me", { phone: managerPhoneInput });
  expect(managerProfile.status).toBe(200);
  expect(managerProfile.body.data.phone).toBe(`+88${managerPhone}`);
  const memberProfile = await member.patch("/api/v1/users/me", { phone: memberPhone });
  expect(memberProfile.status).toBe(200);
  expect(memberProfile.body.data.phone).toBe(`+88${memberPhone}`);
});

afterAll(async () => {
  if (messId) await db.mess.deleteMany({ where: { id: messId } });
  await db.user.deleteMany({ where: { email: { in: [managerEmail, memberEmail] } } });
  await disconnectDb();
});

describe("WhatsApp contact numbers", () => {
  it("shows cross-role Bangladeshi numbers to mess members but hides same-role numbers", async () => {
    const managerMembers = await manager.get(`/api/v1/messes/${messId}/members?status=ACTIVE`);
    expect(managerMembers.status).toBe(200);
    expect(managerMembers.body.data.find((item: { email: string }) => item.email === memberEmail).phone).toBe(`+88${memberPhone}`);

    const memberMembers = await member.get(`/api/v1/messes/${messId}/members?status=ACTIVE`);
    expect(memberMembers.status).toBe(200);
    expect(memberMembers.body.data.find((item: { email: string }) => item.email === managerEmail).phone).toBe(`+88${managerPhone}`);

    expect(managerMembers.body.data.find((item: { email: string }) => item.email === managerEmail).phone).toBeNull();
    expect(memberMembers.body.data.find((item: { email: string }) => item.email === memberEmail).phone).toBeNull();
  });
}, 60000);
