import { z } from "zod";

import { zBdPhone, zUuid } from "../../app/utils/zod-helpers.ts";

const zEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const invitationIdParamSchema = z.object({
  messId: zUuid,
  invitationId: zUuid,
});

export const invitationTokenParamSchema = z.object({
  token: z.string().trim().min(16, "Invalid invitation token").max(200),
});

export const messIdParamOnlySchema = z.object({ messId: zUuid });

export const listInvitationsQuerySchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]).optional(),
});

/** An invitation targets an email, a phone, or both. At least one is required. */
export const createInvitationSchema = z
  .object({
    email: zEmail.optional(),
    phone: zBdPhone.optional(),
    role: z.enum(["MANAGER", "MEMBER"]).default("MEMBER"),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Provide an email address or a phone number",
    path: ["email"],
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
