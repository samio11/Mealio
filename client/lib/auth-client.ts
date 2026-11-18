"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better-Auth browser client.
 *
 * Requests go to the same origin (`/api/auth/*`) and are proxied to the API by
 * Next.js, so the session cookie is first-party and no CORS handling is needed.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
