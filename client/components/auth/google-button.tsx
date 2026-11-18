"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

/**
 * "Continue with Google" button.
 *
 * Better-Auth performs the OAuth dance on the server (`/api/auth/sign-in/social`)
 * and owns the redirect. `callbackURL`/`newUserCallbackURL` must be absolute
 * client-origin URLs because the API does not serve the frontend pages.
 */
export function GoogleButton({
  callbackPath = "/dashboard",
  newUserCallbackPath = "/onboarding",
  label = "Continue with Google",
}: {
  callbackPath?: string;
  newUserCallbackPath?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    // Compute absolute URLs at click time so they point back to this client host.
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const callbackURL = `${origin}${callbackPath}`;
    const newUserCallbackURL = `${origin}${newUserCallbackPath}`;

    setPending(true);
    const { error } = await signIn.social({
      provider: "google",
      callbackURL,
      newUserCallbackURL,
    });
    // On success the browser is redirected by the server, so anything reaching
    // this line is a failure worth reporting.
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Could not start Google sign-in. Please try again.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      loading={pending}
      onClick={() => void handleClick()}
    >
      {pending ? null : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-4">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l4.01-3.09Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.09C6.23 6.86 8.88 4.75 12 4.75Z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}
