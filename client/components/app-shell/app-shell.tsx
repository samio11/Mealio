"use client";

import { Menu, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { MessSwitcher } from "@/components/app-shell/mess-switcher";
import { MonthSelector } from "@/components/app-shell/month-selector";
import { NavLinks } from "@/components/app-shell/nav-links";
import { UserMenu } from "@/components/app-shell/user-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { NotFoundState } from "@/components/shared/not-found-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/ui/logo";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { useMe, useMess, useMonths } from "@/lib/hooks/queries";
import { MonthProvider } from "@/lib/context/active-month";
import { ApiError, messageFrom } from "@/lib/api/client";
import { useLocale } from "@/lib/locale";

/**
 * Authenticated chrome for a single mess: persistent section nav, the mess
 * switcher and the month the whole app is scoped to.
 */
export function AppShell({ messId, children }: { messId: string; children: ReactNode }) {
  const messQuery = useMess(messId);
  const monthsQuery = useMonths(messId);
  const { data: profile } = useMe();
  const { translate: t } = useLocale();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Remember the mess so /dashboard can send the user straight back here.
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("mm:lastMess", messId);
  }, [messId]);

  const loading = messQuery.isPending || monthsQuery.isPending;

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoadingAnimation label={t("Loading mess…")} />
        <span>{t("Loading mess…")}</span>
      </div>
    );
  }

  if (messQuery.isError || !messQuery.data) {
    const notAllowed = messQuery.error instanceof ApiError && messQuery.error.isForbidden;
    const notFound = !messQuery.data || (messQuery.error instanceof ApiError && messQuery.error.isNotFound);
    if (notFound && !notAllowed) {
      return (
        <NotFoundState
          title="Mess not available"
          description="The page or data you requested could not be found."
          backHref="/dashboard"
          backLabel="Back to dashboard"
        />
      );
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShieldAlert className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{notAllowed ? "You do not have access" : "Mess not available"}</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {notAllowed
              ? "Your membership for this mess is not active. Ask a manager to re-activate it."
              : messageFrom(messQuery.error)}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Back to my messes</Link>
        </Button>
      </div>
    );
  }

  const mess = messQuery.data;
  const months = monthsQuery.data ?? [];
  const role = mess.myRole;

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1">
      <Logo className="size-7" />
      <span className="text-sm font-semibold tracking-tight">Mealio</span>
    </Link>
  );

  const sidebarContent = (
    <>
      {brand}
      <div className="px-1 pt-3">
        <MessSwitcher messId={messId} messName={mess.name} />
      </div>
      <div className="mt-3 flex-1 overflow-y-auto px-1">
        <NavLinks messId={messId} role={role} onNavigate={() => setMobileNavOpen(false)} />
        {profile?.platformRole === "ADMIN" ? (
          <Link
            href="/admin"
            onClick={() => setMobileNavOpen(false)}
            className="mt-2 flex items-center gap-2.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ShieldCheck className="size-4 shrink-0" />
            <span className="truncate">{t("Platform administration")}</span>
          </Link>
        ) : null}
      </div>
      <div className="px-2 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span>Your role</span>
          <StatusBadge status={role} />
        </span>
      </div>
    </>
  );

  return (
    <MonthProvider messId={messId} months={months}>
      <div className="min-h-dvh bg-muted/30">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card px-3 py-3 lg:flex">
          {sidebarContent}
        </aside>

        {/* Mobile nav */}
        <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[80vw] translate-x-0 translate-y-0 rounded-none rounded-r-xl border-l-0 p-3">
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <div className="flex h-full flex-col">{sidebarContent}</div>
          </DialogContent>
        </Dialog>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu />
            </Button>
            <div className="lg:hidden">{brand}</div>
            <div className="ml-auto flex items-center gap-2">
              <MonthSelector className="max-w-[10rem] sm:max-w-none" />
              <UserMenu messId={messId} />
            </div>
          </header>

          {mess.archived ? (
            <div className="border-b bg-warning/10 px-4 py-2 text-sm text-warning-foreground sm:px-6">
              This mess is archived. Data stays visible, but new records should not be added.
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </MonthProvider>
  );
}
