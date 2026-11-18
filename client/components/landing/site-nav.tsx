"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { signOut, useSession } from "@/lib/auth-client";
import { useLocale } from "@/lib/locale";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#examples", label: "Examples" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { locale, setLocale, translate: t } = useLocale();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      setOpen(false);
      toast.success(t("Signed out"));
      router.refresh();
    } catch (error) {
      setSigningOut(false);
      toast.error(error instanceof Error ? error.message : t("Could not sign out"));
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">Mealio</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div
          role="group"
          aria-label="Choose language"
          className="ml-auto inline-flex shrink-0 items-center rounded-lg border bg-background p-0.5 md:ml-2"
        >
          <Button
            type="button"
            size="sm"
            variant={locale === "en" ? "default" : "ghost"}
            aria-pressed={locale === "en"}
            aria-label="Switch language to English"
            onClick={() => setLocale("en")}
            className="h-8 px-2.5"
          >
            EN
          </Button>
          <Button
            type="button"
            size="sm"
            variant={locale === "bn" ? "default" : "ghost"}
            aria-pressed={locale === "bn"}
            aria-label="Switch language to Bangla"
            onClick={() => setLocale("bn")}
            className="h-8 px-2.5"
          >
            বাংলা
          </Button>
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {isPending ? (
            <span className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-hidden />
          ) : session ? (
            <>
              <Button asChild size="sm">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
              <Button size="sm" variant="outline" disabled={signingOut} onClick={() => void handleSignOut()}>
                <LogOut className="size-4" />
                {t("Sign out")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-0 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open ? (
        <div className="border-t bg-background px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2">
            {session ? (
              <>
                <Button asChild>
                  <Link href="/dashboard" onClick={() => setOpen(false)}>Open dashboard</Link>
                </Button>
                <Button variant="outline" disabled={signingOut} onClick={() => void handleSignOut()}>
                  <LogOut className="size-4" />
                  {t("Sign out")}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get started — it is free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
