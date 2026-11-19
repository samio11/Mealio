import { describe, expect, it } from "vitest";

import { buildInvitationEmail } from "../../src/modules/invitations/invitation-email.ts";

describe("invitation email", () => {
  it("renders a branded invitation with usable links and a plain-text fallback", () => {
    const email = buildInvitationEmail({
      to: "member@example.com",
      token: "invite-token",
      inviteUrl: "https://mealio.example/invitations/invite-token",
      messName: "Dhanmondi Mess",
      area: "Dhaka",
      invitedByName: "Mess Manager",
      role: "MEMBER",
      expiresAt: new Date("2026-11-26T06:00:00.000Z"),
    });

    expect(email.subject).toBe("You're invited to join Dhanmondi Mess on Mealio");
    expect(email.html).toContain('src="cid:mealio-logo"');
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments?.[0]).toMatchObject({
      filename: "mealio-logo.png",
      contentType: "image/png",
      cid: "mealio-logo",
      contentDisposition: "inline",
    });
    const logoBytes = email.attachments?.[0]?.content;
    if (!Buffer.isBuffer(logoBytes)) throw new Error("Expected an inline PNG logo attachment");
    expect(logoBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(email.html).toContain("Accept invitation");
    expect(email.html).toContain("Your role");
    expect(email.html).toContain("invite-token");
    expect(email.html).toContain("#0f6549");
    expect(email.html).not.toContain("#2563eb");
    expect(email.text).toContain("https://mealio.example/invitations/invite-token");
    expect(email.text).toContain("Invitation code: invite-token");
  });

  it("escapes untrusted mess and inviter details in HTML and normalizes subject newlines", () => {
    const email = buildInvitationEmail({
      to: "member@example.com",
      token: "safe-token",
      inviteUrl: "https://mealio.example/invitations/safe-token",
      messName: 'Mess <img src=x onerror="alert(1)">\nHello',
      area: "<script>bad()</script>",
      invitedByName: "<b>Manager</b>",
      role: "MANAGER",
      expiresAt: new Date("2026-11-26T06:00:00.000Z"),
    });

    expect(email.subject).toBe('You\'re invited to join Mess <img src=x onerror="alert(1)"> Hello on Mealio');
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain("&lt;script&gt;bad()&lt;/script&gt;");
    expect(email.html).toContain("&lt;b&gt;Manager&lt;/b&gt;");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<script>");
  });
});
