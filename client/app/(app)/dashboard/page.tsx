"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, UserPlus } from "lucide-react";
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
import { signOut } from "@/lib/auth-client";
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
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useMyMesses();
  const { data: profile } = useMe();
  const { translate: t } = useLocale();

  const active = (data ?? []).filter((mess) => mess.status === "ACTIVE");

  /** Members without a mess must be able to leave instead of being pushed into creating one. */
  async function handleSignOut() {
    await signOut();
    queryClient.clear();
    router.push("/sign-in");
  }

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
          description={t("You are not part of an active mess yet. Nothing has to be created here — members simply wait for an invitation.")}
          actions={
            <Button variant="outline" onClick={() => void handleSignOut()}>
              <LogOut />
              {t("Sign out")}
            </Button>
          }
        />
        {profile?.platformRole === "ADMIN" ? (
          <Button asChild variant="outline">
            <Link href="/admin">{t("Platform administration")}</Link>
          </Button>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{t("Waiting for an invitation?")}</CardTitle>
            <CardDescription>
              {t("When a manager invites you, open the button in the email. It fills in your code here; sign in with the invited account and press Join mess.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/onboarding?mode=join">
                <UserPlus />
                {t("I have an invitation code")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Setting up your own mess")}</CardTitle>
            <CardDescription>
              {t("Optional. Creating a mess takes a minute and makes you its manager, so you can then invite the other residents.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/onboarding">
                <Plus />
                {t("Create a mess")}
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
