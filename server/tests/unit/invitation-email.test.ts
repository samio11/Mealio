import { describe, expect, it } from "vitest";

import { buildInvitationEmail } from "../../src/modules/invitations/invitation-email.ts";

describe("invitation email", () => {
  it("sends only the invitation code and a button that opens the code entry screen", () => {
    const email = buildInvitationEmail({
      to: "member@example.com",
      token: "invite-token",
      messName: "Dhanmondi Mess",
    });

    expect(email.subject).toBe("You're invited to join Dhanmondi Mess on Mealio");
    expect(email.html).toContain("Paste invitation code");
    expect(email.html).toContain("invite-token");
    expect(email.html).toContain("/onboarding?mode=join&amp;invitationCode=invite-token");
    expect(email.html.match(/<a\b/g)).toHaveLength(1);
    expect(email.html).not.toContain("Accept invitation");
    expect(email.html).not.toContain("Your role");
    expect(email.html).not.toContain("mealio-logo");
    expect(email.text).toContain("Invitation code: invite-token");
    expect(email.text).toContain("/onboarding?mode=join&invitationCode=invite-token");
  });

  it("escapes an untrusted mess name in HTML and normalizes subject newlines", () => {
    const email = buildInvitationEmail({
      to: "member@example.com",
      token: "safe-token",
      messName: 'Mess <img src=x onerror="alert(1)">\nHello',
    });

    expect(email.subject).toBe('You\'re invited to join Mess <img src=x onerror="alert(1)"> Hello on Mealio');
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).not.toContain("<img src=x");
  });
});
