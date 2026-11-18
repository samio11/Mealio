/**
 * Timezone helpers.
 *
 * Asia/Dhaka is a fixed UTC+06:00 offset and has observed no DST since 2009,
 * so wall-clock maths is done with a constant offset. A timezone library is
 * intentionally avoided: a fixed offset is deterministic, testable and exact
 * for all current Bangladeshi dates.
 *
 * Convention: calendar dates (Prisma `@db.Date` columns) are stored as the UTC
 * midnight instant of that Dhaka calendar date.
 */

export const DHAKA_TIMEZONE = "Asia/Dhaka";
export const DHAKA_OFFSET_MINUTES = 6 * 60; // +06:00

const MS_PER_MINUTE = 60_000;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Current instant shifted into Dhaka wall-clock parts. */
export function toDhakaParts(date: Date = new Date()): DateParts {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MINUTES * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** "YYYY-MM-DD" for the Dhaka calendar date of the given instant. */
export function toDhakaDateString(date: Date = new Date()): string {
  const p = toDhakaParts(date);
  return `${p.year.toString().padStart(4, "0")}-${p.month.toString().padStart(2, "0")}-${p.day
    .toString()
    .padStart(2, "0")}`;
}

/** Parse "YYYY-MM-DD" into calendar parts. Throws on malformed input. */
export function parseDateString(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date (expected YYYY-MM-DD): ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`Invalid date: ${value}`);
  return { year, month, day };
}

/** Date value for a Prisma `@db.Date` column: UTC midnight of the given calendar date. */
export function toDateOnly(value: string | DateParts): Date {
  const parts = typeof value === "string" ? parseDateString(value) : value;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** Inverse of {@link toDateOnly}: "YYYY-MM-DD" from a `@db.Date` value. */
export function fromDateOnly(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

/** The exact UTC instant at which a Dhaka wall-clock time occurs. */
export function dhakaInstant(
  dateString: string,
  minutesFromMidnight: number,
  seconds = 0,
): Date {
  const { year, month, day } = parseDateString(dateString);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(utcMidnight + (minutesFromMidnight - DHAKA_OFFSET_MINUTES) * MS_PER_MINUTE + seconds * 1000);
}

/** Whether the current instant is strictly after a Dhaka wall-clock cut-off. */
export function hasDhakaCutoffPassed(dateString: string, cutoffMinutes: number, now = new Date()): boolean {
  return now.getTime() > dhakaInstant(dateString, cutoffMinutes).getTime();
}

/** "08:00" -> 480 */
export function hhmmToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time (expected HH:MM): ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 480 -> "08:00" */
export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** All Dhaka calendar dates of a month as "YYYY-MM-DD". */
export function eachDateOfMonth(year: number, month: number): string[] {
  const total = daysInMonth(year, month);
  const prefix = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
  return Array.from({ length: total }, (_, i) => `${prefix}-${(i + 1).toString().padStart(2, "0")}`);
}

/** Inclusive start / exclusive end instants (UTC) covering a Dhaka calendar month. */
export function dhakaMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = dhakaInstant(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`, 0);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = dhakaInstant(`${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}-01`, 0);
  return { start, end };
}

/** Validate a (year, month) pair. */
export function assertValidYearMonth(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error(`Invalid year: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
}
