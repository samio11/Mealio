"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const { translate: t } = useLocale();

  const next = params.get("next");

  useEffect(() => {
    if (isPending || session) return;
    const target = next && next.startsWith("/") ? next : "/dashboard";
    router.replace(`/sign-in?next=${encodeURIComponent(target)}`);
  }, [isPending, session, next, router]);

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
