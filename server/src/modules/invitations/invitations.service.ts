import { randomBytes } from "node:crypto";

import type { MessInvitation } from "../../generated/prisma/client.ts";
import { env } from "../../app/config/env.ts";
import { INVITATION_TTL_DAYS } from "../../app/config/constants.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { logger } from "../../app/utils/logger.ts";
import { sendMail } from "../../app/utils/mailer.ts";
import type { CreateInvitationInput, ListInvitationsQuery } from "./invitations.schema.ts";

export interface InvitationDto {
  id: string;
  messId: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  /** Only returned at creation time so a manager can share the link manually. */
  token?: string;
  inviteUrl?: string;
}

export interface InvitationPreviewDto {
  messId: string;
  messName: string;
  area: string | null;
  invitedByName: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  status: string;
  expiresAt: string;
  alreadyMember: boolean;
  canAccept: boolean;
}

function toInvitationDto(inv: MessInvitation, includeToken = false): InvitationDto {
  return {
    id: inv.id,
    messId: inv.messId,
    email: inv.email,
    phone: inv.phone,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    ...(includeToken ? { token: inv.token, inviteUrl: buildInviteUrl(inv.token) } : {}),
  };
}

function buildInviteUrl(token: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/invitations/${token}`;
}

/**
 * Loads an invitation by token and rejects anything that is no longer usable.
 * Expired PENDING invitations are transitioned to EXPIRED so the list view
 * stays honest.
 */
async function loadUsableInvitation(token: string): Promise<MessInvitation> {
  const invitation = await db.messInvitation.findUnique({ where: { token } });
  if (!invitation) throw AppError.notFound("This invitation link is not valid");

  if (invitation.status === "REVOKED") throw AppError.business("This invitation has been revoked");
  if (invitation.status === "ACCEPTED") throw AppError.business("This invitation has already been used");

  if (invitation.expiresAt.getTime() <= Date.now()) {
    if (invitation.status === "PENDING") {
      await db.messInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    }
    throw AppError.business("This invitation has expired");
  }

  return invitation;
}

export async function createInvitation(
  messId: string,
  actorUserId: string,
  input: CreateInvitationInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<InvitationDto> {
  const email = input.email ?? null;
  const phone = input.phone ?? null;

  // Reject inviting somebody who is already active in this mess.
  if (email || phone) {
    const existingUser = await db.user.findFirst({
      where: {
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
      select: { id: true },
    });
    if (existingUser) {
      const membership = await db.messMembership.findUnique({
        where: { messId_userId: { messId, userId: existingUser.id } },
        select: { status: true },
      });
      if (membership?.status === "ACTIVE") {
        throw AppError.conflict("That person is already an active member of this mess");
      }
    }
  }

  const duplicate = await db.messInvitation.findFirst({
    where: {
      messId,
      status: "PENDING",
      ...(email ? { email } : { phone }),
    },
    select: { id: true },
  });
  if (duplicate) throw AppError.conflict("A pending invitation already exists for this person");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await db.$transaction(async (tx) => {
    const created = await tx.messInvitation.create({
      data: { messId, email, phone, role: input.role, token, status: "PENDING", invitedById: actorUserId, expiresAt },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessInvitation",
      entityId: created.id,
      action: "CREATE",
      after: { email, phone, role: input.role, expiresAt },
      ...ctx,
    });

    return created;
  });

  if (email) {
    const mess = await db.mess.findUnique({ where: { id: messId }, select: { name: true } });
    void sendMail({
      to: email,
      subject: `You are invited to join "${mess?.name ?? "a mess"}" on Mess Management`,
      text: `Open this link to join: ${buildInviteUrl(token)}\n\nOr sign in and paste this invitation code: ${token}\n\nThe invitation expires in ${INVITATION_TTL_DAYS} days.`,
      html: `<p>You have been invited to join <strong>${mess?.name ?? "a mess"}</strong>.</p><p><a href="${buildInviteUrl(token)}">Accept invitation</a></p><p>Or sign in and paste this invitation code:</p><p><code>${token}</code></p><p>The invitation expires in ${INVITATION_TTL_DAYS} days.</p>`,
    }).catch((error: unknown) => logger.error({ err: error }, "failed to queue invitation email"));
  }

  return toInvitationDto(invitation, true);
}

export async function listInvitations(messId: string, query: ListInvitationsQuery): Promise<InvitationDto[]> {
  const invitations = await db.messInvitation.findMany({
    where: { messId, ...(query.status ? { status: query.status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map((invitation) => toInvitationDto(invitation));
}

export async function revokeInvitation(
  messId: string,
  invitationId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<InvitationDto> {
  const invitation = await db.messInvitation.findFirst({ where: { id: invitationId, messId } });
  if (!invitation) throw AppError.notFound("Invitation not found");
  if (invitation.status !== "PENDING") {
    throw AppError.conflict(`Only a pending invitation can be revoked (current status: ${invitation.status})`);
  }

  const updated = await db.$transaction(async (tx) => {
    const revoked = await tx.messInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessInvitation",
      entityId: invitationId,
      action: "REVOKE",
      before: { status: invitation.status },
      after: { status: revoked.status },
      ...ctx,
    });

    return revoked;
  });

  return toInvitationDto(updated);
}

export async function previewInvitation(token: string, userId: string): Promise<InvitationPreviewDto> {
  const invitation = await loadUsableInvitation(token);

  const [mess, inviter, membership] = await Promise.all([
    db.mess.findUnique({ where: { id: invitation.messId }, select: { name: true, area: true } }),
    db.user.findUnique({ where: { id: invitation.invitedById }, select: { name: true } }),
    db.messMembership.findUnique({
      where: { messId_userId: { messId: invitation.messId, userId } },
      select: { status: true },
    }),
  ]);

  return {
    messId: invitation.messId,
    messName: mess?.name ?? "Mess",
    area: mess?.area ?? null,
    invitedByName: inviter?.name ?? null,
    role: invitation.role,
    email: invitation.email,
    phone: invitation.phone,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    alreadyMember: membership?.status === "ACTIVE",
    canAccept: membership?.status !== "ACTIVE",
  };
}

export interface AcceptInvitationResult {
  messId: string;
  messName: string;
  role: string;
  membershipId: string;
}

export async function acceptInvitation(
  token: string,
  userId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<AcceptInvitationResult> {
  const invitation = await loadUsableInvitation(token);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true },
  });
  if (!user) throw AppError.unauthorized();

  const identityMatches =
    (invitation.email !== null && user.email.toLowerCase() === invitation.email.toLowerCase()) ||
    (invitation.phone !== null && user.phone === invitation.phone);
  if (!identityMatches) {
    throw AppError.forbidden("This invitation was sent to a different account");
  }

  const existing = await db.messMembership.findUnique({
    where: { messId_userId: { messId: invitation.messId, userId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "ACTIVE") throw AppError.conflict("You are already a member of this mess");

  const result = await db.$transaction(async (tx) => {
    const membership = existing
      ? await tx.messMembership.update({
          where: { id: existing.id },
          data: { role: invitation.role, status: "ACTIVE", leftAt: null },
        })
      : await tx.messMembership.create({
          data: { messId: invitation.messId, userId, role: invitation.role, status: "ACTIVE" },
        });

    await tx.messInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), invitedUserId: userId },
    });

    await writeAuditLog(tx, {
      messId: invitation.messId,
      actorUserId: userId,
      entityType: "MessMembership",
      entityId: membership.id,
      action: "ACCEPT_INVITATION",
      after: { role: membership.role, status: membership.status, invitationId: invitation.id },
      ...ctx,
    });

    return membership;
  });

  const mess = await db.mess.findUnique({ where: { id: invitation.messId }, select: { name: true } });

  return {
    messId: invitation.messId,
    messName: mess?.name ?? "Mess",
    role: result.role,
    membershipId: result.id,
  };
}
