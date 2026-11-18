import type { MealTypeSetting, MessMonth } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { DEFAULT_MEAL_CUTOFFS, MEAL_TYPES } from "../../app/config/constants.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { daysInMonth, dhakaMonthRange, minutesToHhmm, toDhakaParts } from "../../app/utils/date.ts";
import type {
  CreateMonthInput,
  ListMonthsQuery,
  UpdateMealSettingInput,
  UpdateMonthInput,
} from "./months.schema.ts";

type MealSettingRow = MealTypeSetting;

export interface MealSettingDto {
  id: string;
  mealType: string;
  enabled: boolean;
  cutoffMinutes: number;
  cutoff: string;
}

export interface MonthDto {
  id: string;
  year: number;
  month: number;
  label: string;
  status: string;
  openingCashPoisha: string;
  budgetPoisha: string;
  mealRatePolicy: string;
  daysInMonth: number;
  closedAt: string | null;
  createdAt: string;
  mealSettings?: MealSettingDto[];
}

function toMealSettingDto(row: MealSettingRow): MealSettingDto {
  return {
    id: row.id,
    mealType: row.mealType,
    enabled: row.enabled,
    cutoffMinutes: row.cutoffMinutes,
    cutoff: minutesToHhmm(row.cutoffMinutes),
  };
}

function monthLabel(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, "0")}`;
}

function toMonthDto(month: MessMonth, mealSettings?: MealSettingRow[]): MonthDto {
  return {
    id: month.id,
    year: month.year,
    month: month.month,
    label: monthLabel(month.year, month.month),
    status: month.status,
    openingCashPoisha: month.openingCashPoisha.toString(),
    budgetPoisha: month.budgetPoisha.toString(),
    mealRatePolicy: month.mealRatePolicy,
    daysInMonth: daysInMonth(month.year, month.month),
    closedAt: month.closedAt?.toISOString() ?? null,
    createdAt: month.createdAt.toISOString(),
    ...(mealSettings ? { mealSettings: mealSettings.map(toMealSettingDto) } : {}),
  };
}

function buildSnapshot(month: MessMonth, settings: MealSettingRow[]) {
  return {
    capturedAt: new Date().toISOString(),
    year: month.year,
    month: month.month,
    openingCashPoisha: month.openingCashPoisha.toString(),
    budgetPoisha: month.budgetPoisha.toString(),
    mealRatePolicy: month.mealRatePolicy,
    daysInMonth: daysInMonth(month.year, month.month),
    mealSettings: settings.map((s) => ({
      mealType: s.mealType,
      enabled: s.enabled,
      cutoffMinutes: s.cutoffMinutes,
    })),
  };
}

function defaultCutoffFor(mealType: string): number {
  return (DEFAULT_MEAL_CUTOFFS as Record<string, number>)[mealType] ?? 0;
}

/** Month key resolved from either an explicit id or a (year, month) pair. */
export interface MonthRef {
  monthId?: string;
  year?: number;
  month?: number;
}

export async function assertMonthOpen(messId: string, monthId: string): Promise<void> {
  const month = await db.messMonth.findFirst({ where: { id: monthId, messId }, select: { status: true } });
  if (!month) throw AppError.notFound("Month not found");
  if (month.status === "CLOSED") throw AppError.business("This month is closed; records can no longer be changed");
}

export async function listMonths(messId: string, query: ListMonthsQuery): Promise<MonthDto[]> {
  const months = await db.messMonth.findMany({
    where: { messId, ...(query.year ? { year: query.year } : {}), ...(query.status ? { status: query.status } : {}) },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  return months.map((month) => toMonthDto(month));
}

export async function getMonthDetail(messId: string, monthId: string): Promise<MonthDto> {
  const month = await db.messMonth.findFirst({
    where: { id: monthId, messId },
    include: { mealSettings: { orderBy: { mealType: "asc" } } },
  });
  if (!month) throw AppError.notFound("Month not found");
  return toMonthDto(month, month.mealSettings);
}

export async function createMonth(
  messId: string,
  actorUserId: string,
  input: CreateMonthInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MonthDto> {
  const existing = await db.messMonth.findUnique({
    where: { messId_year_month: { messId, year: input.year, month: input.month } },
    select: { id: true },
  });
  if (existing) throw AppError.conflict(`${monthLabel(input.year, input.month)} already exists for this mess`);

  const overrides = new Map((input.mealSettings ?? []).map((s) => [s.mealType, s]));

  const month = await db.$transaction(async (tx) => {
    const created = await tx.messMonth.create({
      data: {
        messId,
        year: input.year,
        month: input.month,
        openingCashPoisha: input.openingCashTaka,
        budgetPoisha: input.budgetTaka,
        mealRatePolicy: input.mealRatePolicy,
      },
    });

    const settings = await Promise.all(
      MEAL_TYPES.map((mealType) => {
        const override = overrides.get(mealType);
        return tx.mealTypeSetting.create({
          data: {
            monthId: created.id,
            mealType,
            enabled: override?.enabled ?? true,
            defaultOn: false,
            cutoffMinutes: override?.cutoff ?? defaultCutoffFor(mealType),
          },
        });
      }),
    );

    await tx.messMonth.update({
      where: { id: created.id },
      data: { settingsSnapshot: buildSnapshot(created, settings) },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessMonth",
      entityId: created.id,
      action: "CREATE",
      after: { year: created.year, month: created.month, budgetPoisha: created.budgetPoisha.toString() },
      ...ctx,
    });

    return { month: created, settings };
  });

  return toMonthDto(month.month, month.settings);
}

/**
 * Resolves a month for financial writes: either an explicit `monthId` that
 * belongs to the mess, or a (year, month) pair which is created on demand with
 * default settings (opening cash / budget 0).
 */
export async function ensureMonth(messId: string, ref: MonthRef): Promise<MessMonth> {
  if (ref.monthId) {
    const month = await db.messMonth.findFirst({ where: { id: ref.monthId, messId } });
    if (!month) throw AppError.notFound("Month not found in this mess");
    return month;
  }

  if (ref.year === undefined || ref.month === undefined) {
    throw AppError.badRequest("Provide either monthId or year and month");
  }

  const existing = await db.messMonth.findUnique({
    where: { messId_year_month: { messId, year: ref.year, month: ref.month } },
  });
  if (existing) return existing;

  const created = await db.$transaction(async (tx) => {
    const month = await tx.messMonth.create({
      data: { messId, year: ref.year as number, month: ref.month as number },
    });
    await Promise.all(
      MEAL_TYPES.map((mealType) =>
        tx.mealTypeSetting.create({
            data: { monthId: month.id, mealType, enabled: true, defaultOn: false, cutoffMinutes: defaultCutoffFor(mealType) },
        }),
      ),
    );
    return month;
  });
  return created;
}

/** Resolves the month that contains a given Dhaka calendar date (creating it if needed). */
export async function ensureMonthForDate(messId: string, dateString: string): Promise<MessMonth> {
  const parts = toDhakaDateStringParts(dateString);
  return ensureMonth(messId, { year: parts.year, month: parts.month });
}

function toDhakaDateStringParts(dateString: string): { year: number; month: number } {
  const [yearStr, monthStr] = dateString.split("-");
  return { year: Number(yearStr), month: Number(monthStr) };
}

/** The month the mess is currently in, using Asia/Dhaka wall clock. */
export async function ensureCurrentMonth(messId: string): Promise<MessMonth> {
  const parts = toDhakaParts();
  return ensureMonth(messId, { year: parts.year, month: parts.month });
}

export async function updateMonth(
  messId: string,
  monthId: string,
  actorUserId: string,
  input: UpdateMonthInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MonthDto> {
  const before = await db.messMonth.findFirst({ where: { id: monthId, messId } });
  if (!before) throw AppError.notFound("Month not found");
  if (before.status === "CLOSED") throw AppError.business("A closed month cannot be edited");

  const updated = await db.$transaction(async (tx) => {
    const month = await tx.messMonth.update({
      where: { id: monthId },
      data: {
        ...(input.openingCashTaka !== undefined ? { openingCashPoisha: input.openingCashTaka } : {}),
        ...(input.budgetTaka !== undefined ? { budgetPoisha: input.budgetTaka } : {}),
        ...(input.mealRatePolicy !== undefined ? { mealRatePolicy: input.mealRatePolicy } : {}),
      },
      include: { mealSettings: { orderBy: { mealType: "asc" } } },
    });

    await tx.messMonth.update({
      where: { id: monthId },
      data: { settingsSnapshot: buildSnapshot(month, month.mealSettings) },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessMonth",
      entityId: monthId,
      action: "UPDATE",
      before: { openingCashPoisha: before.openingCashPoisha.toString(), budgetPoisha: before.budgetPoisha.toString() },
      after: { openingCashPoisha: month.openingCashPoisha.toString(), budgetPoisha: month.budgetPoisha.toString() },
      ...ctx,
    });

    return month;
  });

  return toMonthDto(updated, updated.mealSettings);
}

export async function updateMealSetting(
  messId: string,
  monthId: string,
  mealType: string,
  actorUserId: string,
  input: UpdateMealSettingInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MonthDto> {
  const month = await db.messMonth.findFirst({ where: { id: monthId, messId } });
  if (!month) throw AppError.notFound("Month not found");
  if (month.status === "CLOSED") throw AppError.business("A closed month cannot be edited");

  const before = await db.mealTypeSetting.findUnique({
    where: { monthId_mealType: { monthId, mealType: mealType as never } },
  });
  if (!before) throw AppError.notFound("Meal setting not found");

  await db.$transaction(async (tx) => {
    await tx.mealTypeSetting.update({
      where: { monthId_mealType: { monthId, mealType: mealType as never } },
      data: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.cutoff !== undefined ? { cutoffMinutes: input.cutoff } : {}),
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MealTypeSetting",
      entityId: before.id,
      action: "UPDATE",
      before: { enabled: before.enabled, cutoffMinutes: before.cutoffMinutes },
      after: { enabled: input.enabled ?? before.enabled, cutoffMinutes: input.cutoff ?? before.cutoffMinutes },
      ...ctx,
    });
  });

  return getMonthDetail(messId, monthId);
}

export async function setMonthStatus(
  messId: string,
  monthId: string,
  actorUserId: string,
  status: "OPEN" | "CLOSED",
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MonthDto> {
  const month = await db.messMonth.findFirst({
    where: { id: monthId, messId },
    include: { mealSettings: true },
  });
  if (!month) throw AppError.notFound("Month not found");
  if (month.status === status) {
    throw AppError.conflict(`This month is already ${status.toLowerCase()}`);
  }

  const updated = await db.$transaction(async (tx) => {
    if (status === "CLOSED") {
      await tx.mealTypeSetting.updateMany({
        where: { monthId, defaultOn: true },
        data: { defaultOn: false },
      });
    }

    const settings =
      status === "CLOSED"
        ? await tx.mealTypeSetting.findMany({ where: { monthId } })
        : month.mealSettings;

    const next = await tx.messMonth.update({
      where: { id: monthId },
      data: {
        status,
        closedAt: status === "CLOSED" ? new Date() : null,
        // Snapshot on close so historical reports keep reproducing old settings.
        settingsSnapshot: status === "CLOSED" ? buildSnapshot(month, settings) : month.settingsSnapshot ?? undefined,
      },
      include: { mealSettings: { orderBy: { mealType: "asc" } } },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessMonth",
      entityId: monthId,
      action: status === "CLOSED" ? "CLOSE" : "REOPEN",
      before: { status: month.status },
      after: { status },
      ...ctx,
    });

    return next;
  });

  return toMonthDto(updated, updated.mealSettings);
}

/** Inclusive date range of the month, expressed as Dhaka calendar dates. */
export function monthDateRange(year: number, month: number): { start: Date; end: Date } {
  return dhakaMonthRange(year, month);
}
