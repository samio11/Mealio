import { Suspense, type ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Everything in this group requires a signed-in user. The guard is a client
 * component (Better-Auth sessions live in cookies), so it is wrapped in a
 * Suspense boundary to keep static rendering happy.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
