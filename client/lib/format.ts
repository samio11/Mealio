/**
 * Presentation helpers. Money arrives from the API as an integer-poisha string;
 * these functions only ever *describe* it — never do float arithmetic on money.
 */

const TAKA_SIGN = "৳";

/** Formats a poisha string/number as "৳1,234.56". */
export function formatPoisha(poisha: string | number | null | undefined, options?: { sign?: boolean }): string {
  if (poisha === null || poisha === undefined || poisha === "") return `${TAKA_SIGN}0.00`;
  const value = BigInt(typeof poisha === "string" ? poisha : Math.round(poisha));
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const taka = abs / 100n;
  const paisa = (abs % 100n).toString().padStart(2, "0");
  const grouped = taka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = negative ? "-" : options?.sign ? "+" : "";
  return `${prefix}${TAKA_SIGN}${grouped}.${paisa}`;
}

/** Same as {@link formatPoisha} but without the ৳ symbol (for table columns with a heading). */
export function formatPoishaPlain(poisha: string | number | null | undefined): string {
  return formatPoisha(poisha).replace(TAKA_SIGN, "");
}

/** "৳1,234" — drops paisa when the amount is a whole taka. */
export function formatPoishaCompact(poisha: string | number | null | undefined): string {
  const formatted = formatPoisha(poisha);
  return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
}

/** Formats an ISO timestamp as a short Dhaka-local date+time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Formats a `YYYY-MM-DD` calendar date (already Dhaka-local) for display. */
export function formatDate(dateOnly: string | null | undefined): string {
  if (!dateOnly) return "—";
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Short form: "5 Dec". */
export function formatDateShort(dateOnly: string | null | undefined): string {
  if (!dateOnly) return "—";
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function monthName(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2020, month - 1, 1)),
  );
}

/** "December 2026" from a (year, month) pair. */
export function monthLabelLong(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

/** Title-cases a SCREAMING_SNAKE enum value: "MEAL_BAZAR" → "Meal bazar". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** "12 Dec 2026" for a `YYYY-MM-DD` string used in <input type="date"> contexts. */
export function toDateInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

/** Today's date in Dhaka as `YYYY-MM-DD`. */
export function todayInDhaka(): string {
  return toDateInputValue(new Date());
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Percentage helper for progress bars (already-computed server percentages included). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
