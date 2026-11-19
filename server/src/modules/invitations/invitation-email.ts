import { env } from "../../app/config/env.ts";
import { INVITATION_TTL_DAYS } from "../../app/config/constants.ts";
import type { MailInput } from "../../app/utils/mailer.ts";
import { mealioLogoAttachment } from "./mealio-logo.ts";

interface InvitationEmailInput {
  to: string;
  token: string;
  inviteUrl: string;
  messName: string;
  area: string | null;
  invitedByName: string;
  role: string;
  expiresAt: Date;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function displayRole(role: string): string {
  return role === "MANAGER" ? "Manager" : "Member";
}

export function buildInvitationEmail(input: InvitationEmailInput): MailInput {
  const siteUrl = env.FRONTEND_URL.replace(/\/+$/, "");
  const messName = escapeHtml(input.messName);
  const area = input.area ? escapeHtml(input.area) : null;
  const invitedByName = escapeHtml(input.invitedByName);
  const role = escapeHtml(displayRole(input.role));
  const invitationUrl = escapeHtml(input.inviteUrl);
  const token = escapeHtml(input.token);
  const websiteUrl = escapeHtml(siteUrl);
  const expiresAt = new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(input.expiresAt);
  const subjectMessName = input.messName.replace(/[\r\n]+/g, " ").trim();
  const subject = `You're invited to join ${subjectMessName} on Mealio`;
  const areaRow = area
    ? `<tr>
        <td style="padding: 0 0 12px; color: #64748b; font-size: 13px;">Area</td>
        <td align="right" style="padding: 0 0 12px; color: #0f172a; font-size: 14px; font-weight: 600;">${area}</td>
      </tr>`
    : "";

  const text = [
    `${input.invitedByName} invited you to join ${input.messName} on Mealio as a ${displayRole(input.role)}.`,
    "",
    `Accept your invitation: ${input.inviteUrl}`,
    "",
    `Invitation code: ${input.token}`,
    `This invitation expires on ${expiresAt} Bangladesh time (in ${INVITATION_TTL_DAYS} days).`,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
    `Mealio: ${siteUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f8f5; color: #24352d; font-family: Arial, Helvetica, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
      ${invitedByName} invited you to join ${messName} on Mealio.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f8f5;">
      <tr>
        <td align="center" style="padding: 36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px;">
            <tr>
              <td style="padding: 0 0 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle" style="padding: 6px 10px 6px 6px; background-color: #e8f2eb; border-radius: 12px;">
                      <img src="cid:mealio-logo" width="40" height="40" alt="Mealio logo" style="display: block; width: 40px; height: 40px; border: 0;">
                    </td>
                    <td valign="middle" style="padding-left: 10px; color: #24352d; font-size: 20px; font-weight: 700; letter-spacing: -0.4px;">Mealio</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 36px 32px; background-color: #ffffff; border: 1px solid #dfe9e2; border-radius: 16px;">
                <p style="margin: 0 0 12px; color: #0f6549; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">Mess invitation</p>
                <h1 style="margin: 0 0 14px; color: #24352d; font-size: 28px; line-height: 1.25; letter-spacing: -0.7px;">You’re invited to join ${messName}</h1>
                <p style="margin: 0 0 24px; color: #61736a; font-size: 15px; line-height: 1.7;">
                  <strong style="color: #24352d;">${invitedByName}</strong> invited you to join their mess on Mealio. Accept the invitation to get started.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px; padding: 18px 20px; background-color: #f7faf8; border: 1px solid #dfe9e2; border-radius: 10px;">
                  <tr>
                    <td style="padding: 0 0 12px; color: #61736a; font-size: 13px;">Mess</td>
                    <td align="right" style="padding: 0 0 12px; color: #24352d; font-size: 14px; font-weight: 600;">${messName}</td>
                  </tr>
                  ${areaRow}
                  <tr>
                    <td style="padding: 0; color: #61736a; font-size: 13px;">Your role</td>
                    <td align="right" style="padding: 0; color: #24352d; font-size: 14px; font-weight: 600;">${role}</td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px;">
                  <tr>
                    <td align="center" bgcolor="#0f6549" style="border-radius: 9px;">
                      <a href="${invitationUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; border: 1px solid #0f6549; border-radius: 9px; color: #ffffff; font-size: 15px; font-weight: 700; line-height: 20px; text-decoration: none;">Accept invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px; color: #61736a; font-size: 13px; line-height: 1.6; text-align: center;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 24px; overflow-wrap: anywhere; color: #0f6549; font-size: 12px; line-height: 1.6; text-align: center;">
                  <a href="${invitationUrl}" style="color: #0f6549; text-decoration: underline;">${invitationUrl}</a>
                </p>
                <div style="padding: 16px 18px; background-color: #edf6f0; border: 1px solid #d5e8db; border-radius: 9px;">
                  <p style="margin: 0 0 6px; color: #174b38; font-size: 13px; font-weight: 700;">Prefer to enter a code?</p>
                  <p style="margin: 0; color: #285b42; font-size: 14px; line-height: 1.6;">
                    Sign in to Mealio and enter <strong style="font-family: 'Courier New', monospace; letter-spacing: 0.4px;">${token}</strong>.
                  </p>
                </div>
                <p style="margin: 20px 0 0; color: #61736a; font-size: 12px; line-height: 1.6; text-align: center;">
                  This invitation expires ${expiresAt} Bangladesh time (${INVITATION_TTL_DAYS} days after it was sent).
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 12px 0; color: #61736a; font-size: 12px; line-height: 1.7; text-align: center;">
                If you weren’t expecting this invitation, you can safely ignore this email.<br>
                <a href="${websiteUrl}" style="color: #0f6549; text-decoration: underline;">Mealio</a> · Shared living, organized.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: input.to,
    subject,
    text,
    html,
    attachments: [mealioLogoAttachment],
  };
}
