import { cn } from "@/lib/utils";
import { formatPoisha, formatPoishaCompact } from "@/lib/format";

/**
 * Renders an integer-poisha value as ৳. Money always arrives from the API as a
 * string (the server serialises BigInt that way) — this component never does
 * arithmetic on it, it only formats.
 */
export function Money({
  value,
  className,
  compact = false,
  signed = false,
  tone = "default",
}: {
  value: string | number | null | undefined;
  className?: string;
  /** Drop the paisa when the amount is a whole taka (good for dense tables). */
  compact?: boolean;
  /** Prefix positive values with "+" (useful for balances). */
  signed?: boolean;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  const isNegative = (() => {
    if (value === null || value === undefined || value === "") return false;
    try {
      return BigInt(typeof value === "string" ? value : Math.round(value)) < 0n;
    } catch {
      return false;
    }
  })();

  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative" || (tone === "default" && isNegative)
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";

  return (
    <span className={cn("tabular whitespace-nowrap", toneClass, className)}>
      {compact ? formatPoishaCompact(value) : formatPoisha(value, { sign: signed })}
    </span>
  );
}
