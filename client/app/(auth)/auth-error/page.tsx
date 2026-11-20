"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { BlockedUserAnimation } from "@/components/ui/lottie-animation";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const { translate: t } = useLocale();
  const blocked = searchParams.get("error") === "ACCOUNT_BLOCKED";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      {blocked ? <BlockedUserAnimation /> : null}
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(blocked ? "Account temporarily blocked" : "Could not complete sign in")}
        </h1>
        {blocked ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("An administrator has blocked access to this account. You cannot sign in while it is blocked.")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("Please wait for an administrator to unblock your account. If you believe this is a mistake, contact the administrator.")}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("There was a problem completing sign in. Please return to sign in and try again.")}
          </p>
        )}
      </div>
      <Button asChild>
        <Link href="/sign-in">{t("Return to sign in")}</Link>
      </Button>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
