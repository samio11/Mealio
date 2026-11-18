"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NotFoundAnimation } from "@/components/ui/lottie-animation";
import { useLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export function NotFoundState({
  title = "Not found",
  description = "The page or data you requested could not be found.",
  backHref = "/",
  backLabel,
  compact = false,
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
}) {
  const { translate: t } = useLocale();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 text-center",
        compact ? "py-4" : "min-h-dvh py-10",
      )}
    >
      <NotFoundAnimation size={compact ? "medium" : "large"} />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t(title)}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t(description)}</p>
      </div>
      <Button asChild>
        <Link href={backHref}>
          <ArrowLeft />
          {t(backLabel ?? (backHref === "/" ? "Back to home" : "Back"))}
        </Link>
      </Button>
    </div>
  );
}
