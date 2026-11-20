"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { useSession } from "@/lib/auth-client";
import { useLocale } from "@/lib/locale";

/**
 * Client-side gate for authenticated areas. The real authorization is enforced
 * by the API on every request; this only keeps the UI honest and avoids
 * flashing protected content.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const { translate: t } = useLocale();

  const next = params.get("next");
  const query = params.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  useEffect(() => {
    if (isPending || session) return;
    const isLocalPath = (value: string | null): value is string =>
      Boolean(value?.startsWith("/") && !value.startsWith("//"));
    const target = isLocalPath(next) ? next : currentPath;
    router.replace(`/sign-in?next=${encodeURIComponent(target)}`);
  }, [isPending, session, next, currentPath, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoadingAnimation label="Checking your session…" />
        <span>{t("Checking your session…")}</span>
      </div>
    );
  }

  return <>{children}</>;
}
