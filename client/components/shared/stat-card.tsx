import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single headline figure with an icon and optional supporting line. Kept
 * deliberately flat — the dashboard uses a small number of these, not a wall
 * of cards.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  action,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning" | "info";
  className?: string;
  action?: ReactNode;
}) {
  const iconTone =
    tone === "positive"
      ? "bg-success/12 text-success"
      : tone === "negative"
        ? "bg-destructive/10 text-destructive"
        : tone === "warning"
          ? "bg-warning/15 text-warning-foreground"
          : tone === "info"
            ? "bg-info/12 text-info"
            : "bg-muted text-muted-foreground";

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="text-xl font-semibold leading-tight">{value}</div>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconTone)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}
