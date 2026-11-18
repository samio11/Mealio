import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

/**
 * Mess-scoped area. The mess id comes from the URL so every page is
 * shareable and the API's tenant check has an unambiguous scope.
 */
export default async function MessLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ messId: string }>;
}) {
  const { messId } = await params;
  return <AppShell messId={messId}>{children}</AppShell>;
}
