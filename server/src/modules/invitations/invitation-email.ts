import { env } from "../../app/config/env.ts";
import type { MailInput } from "../../app/utils/mailer.ts";

interface InvitationEmailInput {
  to: string;
  token: string;
  messName: string;
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

export function buildInvitationEmail(input: InvitationEmailInput): MailInput {
  const siteUrl = env.FRONTEND_URL.replace(/\/+$/, "");
  const messName = escapeHtml(input.messName);
  const token = escapeHtml(input.token);
  const codeEntryUrl = `${siteUrl}/onboarding?mode=join&invitationCode=${encodeURIComponent(input.token)}`;
  const safeCodeEntryUrl = escapeHtml(codeEntryUrl);
  const subjectMessName = input.messName.replace(/[\r\n]+/g, " ").trim();
  const subject = `You're invited to join ${subjectMessName} on Mealio`;

  const text = [
    `You are invited to join ${input.messName} on Mealio.`,
    `Invitation code: ${input.token}`,
    "",
    `Paste your invitation code: ${codeEntryUrl}`,
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
  <body style="margin: 0; padding: 32px 16px; background-color: #f4f8f5; color: #24352d; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding: 36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 440px; background-color: #ffffff; border: 1px solid #dfe9e2; border-radius: 12px;">
            <tr><td style="padding: 28px;">
              <p style="margin: 0 0 20px; color: #0f6549; font-size: 18px; font-weight: 700;">Mealio invitation</p>
              <h1 style="margin: 0 0 12px; color: #24352d; font-size: 22px; line-height: 1.3;">Join ${messName}</h1>
              <p style="margin: 0 0 20px; color: #61736a; font-size: 14px; line-height: 1.6;">Enter this invitation code in Mealio:</p>
              <p style="margin: 0 0 22px; padding: 14px; overflow-wrap: anywhere; border: 1px solid #dfe9e2; border-radius: 8px; background-color: #f7faf8; color: #174b38; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; text-align: center;">${token}</p>
              <p style="margin: 0; text-align: center;">
                <a href="${safeCodeEntryUrl}" style="display: inline-block; padding: 12px 22px; border-radius: 8px; background-color: #0f6549; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Paste invitation code</a>
              </p>
            </td></tr>
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
  };
}
