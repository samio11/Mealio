"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { useMyMesses } from "@/lib/hooks/queries";
import { useMe } from "@/lib/hooks/queries";
import { useLocale } from "@/lib/locale";
import { formatDate } from "@/lib/format";

/**
 * Entry point after sign-in. Resolves which mess to open: remembers the last
 * one used, otherwise sends the user to their first active mess or to
 * onboarding when they belong to none yet.
 */
export default function DashboardResolverPage() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useMyMesses();
  const { data: profile } = useMe();
  const { translate: t } = useLocale();

  const active = (data ?? []).filter((mess) => mess.status === "ACTIVE");

  useEffect(() => {
    if (active.length === 0) return;
    const remembered = typeof window !== "undefined" ? window.localStorage.getItem("mm:lastMess") : null;
    const target = active.find((mess) => mess.messId === remembered) ?? active[0];
    router.replace(`/m/${target.messId}/dashboard`);
  }, [active, router]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoadingAnimation label="Finding your messes…" />
        <span>{t("Finding your messes…")}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (active.length === 0) {
    const pending = (data ?? []).filter((mess) => mess.status !== "ACTIVE");
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10">
        <PageHeader
          title={t("Welcome")}
          description={t("You are not part of an active mess yet. Create one, or accept an invitation to join an existing mess.")}
        />
        {profile?.platformRole === "ADMIN" ? (
          <Button asChild variant="outline">
            <Link href="/admin">{t("Platform administration")}</Link>
          </Button>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Creating a mess takes a minute and makes you its manager.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/onboarding">
                <Plus />
                Create or join a mess
              </Link>
            </Button>
          </CardContent>
        </Card>

        {pending.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Other memberships</CardTitle>
              <CardDescription>These memberships are not active right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.map((mess) => (
                <div key={mess.messId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{mess.name}</span>
                  <StatusBadge status={mess.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <p className="text-xs text-muted-foreground">Today is {formatDate(new Date().toISOString().slice(0, 10))}.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <LoadingAnimation label="Opening your mess…" />
      <span>{t("Opening your mess…")}</span>
    </div>
  );
}
