import type { MealRecord, MealTypeSetting, MessMonth } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import {
  daysInMonth,
  fromDateOnly,
  hasDhakaCutoffPassed,
  minutesToHhmm,
  toDateOnly,
  toDhakaParts,
} from "../../app/utils/date.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { ensureMonth, ensureMonthForDate } from "../months/months.service.ts";
import type {
  BulkMealRecordInput,
  ListMealRecordsQuery,
  GuestMealInput,
  MonthMealOverrideInput,
  OverrideMealRecordInput,
  SetMealRecordInput,
} from "./meals.schema.ts";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER"] as const;
type MealTypeValue = (typeof MEAL_TYPES)[number];

export interface MealRecordDto {
  id: string;
  memberId: string;
  date: string;
  mealType: string;
  status: string;
  source: string;
  changedById: string | null;
  updatedAt: string;
}

export interface GuestMealDto {
  memberId: string;
  date: string;
  mealType: string;
  guestCount: number;
}

function toMealRecordDto(record: MealRecord): MealRecordDto {
  return {
    id: record.id,
    memberId: record.memberId,
    date: fromDateOnly(record.date),
    mealType: record.mealType,
    status: record.status,
    source: record.source,
    changedById: record.changedById,
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function loadMonthOrThrow(messId: string, monthId: string): Promise<MessMonth> {
  const month = await db.messMonth.findFirst({ where: { id: monthId, messId } });
  if (!month) throw AppError.notFound("Month not found");
  return month;
}

async function settingsForMonth(monthId: string): Promise<MealTypeSetting[]> {
  return db.mealTypeSetting.findMany({ where: { monthId } });
}

/**
 * Effective meal counts per member for a month.
 *
 * Open months count explicit ON records plus guest meals. Legacy closed
 * months retain their frozen defaults so finalized reports do not change.
 */
export interface MemberMealCount {
  memberId: string;
  total: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  guestMeals: number;
  activeDays: number;
}

export interface MemberMealTimelineDay {
  day: number;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  breakfastOn: boolean;
  lunchOn: boolean;
  dinnerOn: boolean;
  breakfastGuests: number;
  lunchGuests: number;
  dinnerGuests: number;
}

export interface MemberMealTimeline {
  memberId: string;
  memberName: string;
  days: MemberMealTimelineDay[];
}

interface MemberWindow {
  memberId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

function dayOfMonthInDhaka(date: Date): number {
  return toDhakaParts(date).day;
}

function activeDayRange(member: MemberWindow, year: number, month: number): { start: number; end: number } {
  const total = daysInMonth(year, month);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, total, 23, 59, 59);

  const joinedDay = member.joinedAt.getTime() <= monthStart ? 1 : dayOfMonthInDhaka(member.joinedAt);
  const leftDay =
    member.leftAt && member.leftAt.getTime() <= monthEnd ? dayOfMonthInDhaka(member.leftAt) : total;

  const start = Math.max(1, joinedDay);
  const end = Math.min(total, leftDay);
  return { start, end: Math.max(start - 1, end) };
}

export async function getMealCounts(messId: string, monthId: string): Promise<MemberMealCount[]> {
  const month = await loadMonthOrThrow(messId, monthId);
  const settings = await settingsForMonth(monthId);
  const enabledTypes = settings.filter((s) => s.enabled).map((s) => s.mealType as MealTypeValue);
  const legacyClosedDefaults =
    month.status === "CLOSED" ? new Map(settings.map((setting) => [setting.mealType, setting.defaultOn])) : new Map();

  const memberships = await db.messMembership.findMany({
    where: {
      messId,
      OR: [{ status: "ACTIVE" }, { status: "REMOVED", leftAt: { gte: new Date(Date.UTC(month.year, month.month - 1, 1)) } }],
    },
    select: { id: true, joinedAt: true, leftAt: true },
  });

  const [records, guestRecords] = await Promise.all([
    db.mealRecord.findMany({
      where: { messId, monthId, mealType: { in: enabledTypes as never } },
      select: { memberId: true, date: true, mealType: true, status: true },
    }),
    db.guestMealRecord.findMany({
      where: { messId, monthId, mealType: { in: enabledTypes as never } },
      select: { memberId: true, date: true, mealType: true, guestCount: true },
    }),
  ]);

  const statusByMember = new Map<string, Map<string, Map<number, "ON" | "OFF">>>();
  for (const record of records) {
    const byType = statusByMember.get(record.memberId) ?? new Map<string, Map<number, "ON" | "OFF">>();
    const byDay = byType.get(record.mealType) ?? new Map<number, "ON" | "OFF">();
    byDay.set(dayOfMonthInDhaka(record.date), record.status);
    byType.set(record.mealType, byDay);
    statusByMember.set(record.memberId, byType);
  }

  const guestsByMember = new Map<string, Map<string, Map<number, number>>>();
  for (const guestRecord of guestRecords) {
    const byType = guestsByMember.get(guestRecord.memberId) ?? new Map<string, Map<number, number>>();
    const byDay = byType.get(guestRecord.mealType) ?? new Map<number, number>();
    byDay.set(dayOfMonthInDhaka(guestRecord.date), guestRecord.guestCount);
    byType.set(guestRecord.mealType, byDay);
    guestsByMember.set(guestRecord.memberId, byType);
  }

  const counts: MemberMealCount[] = [];
  for (const membership of memberships) {
    const window = activeDayRange(
      { memberId: membership.id, joinedAt: membership.joinedAt, leftAt: membership.leftAt },
      month.year,
      month.month,
    );
    const activeDays = Math.max(0, window.end - window.start + 1);
    if (activeDays === 0) continue;

    const perType: Record<MealTypeValue, number> = { BREAKFAST: 0, LUNCH: 0, DINNER: 0 };
    let guestMeals = 0;
    for (const mealType of enabledTypes) {
      const byDay = statusByMember.get(membership.id)?.get(mealType);
      const guestByDay = guestsByMember.get(membership.id)?.get(mealType);
      const defaultOn = legacyClosedDefaults.get(mealType) ?? false;
      let onDays = 0;
      for (let day = window.start; day <= window.end; day += 1) {
        const record = byDay?.get(day);
        if (record === "ON" || (month.status === "CLOSED" && record === undefined && defaultOn)) onDays += 1;
        const guests = guestByDay?.get(day) ?? 0;
        onDays += guests;
        guestMeals += guests;
      }
      perType[mealType] = onDays;
    }

    counts.push({
      memberId: membership.id,
      total: perType.BREAKFAST + perType.LUNCH + perType.DINNER,
      breakfast: perType.BREAKFAST,
      lunch: perType.LUNCH,
      dinner: perType.DINNER,
      guestMeals,
      activeDays,
    });
  }

  return counts;
}

export async function getMealTimeline(
  messId: string,
  monthId: string,
  memberId?: string,
): Promise<MemberMealTimeline[]> {
  const month = await loadMonthOrThrow(messId, monthId);
  const settings = await settingsForMonth(monthId);
  const enabledTypes = new Set(settings.filter((setting) => setting.enabled).map((setting) => setting.mealType));
  const legacyClosedDefaults =
    month.status === "CLOSED" ? new Map(settings.map((setting) => [setting.mealType, setting.defaultOn])) : new Map();
  const totalDays = daysInMonth(month.year, month.month);

  const [memberships, records, guestRecords] = await Promise.all([
    db.messMembership.findMany({
      where: {
        messId,
        ...(memberId ? { id: memberId } : {}),
        OR: [
          { status: "ACTIVE" },
          { status: "REMOVED", leftAt: { gte: new Date(Date.UTC(month.year, month.month - 1, 1)) } },
        ],
      },
      select: { id: true, joinedAt: true, leftAt: true, displayName: true, user: { select: { name: true } } },
    }),
    db.mealRecord.findMany({
      where: { messId, monthId, ...(memberId ? { memberId } : {}) },
      select: { memberId: true, date: true, mealType: true, status: true },
    }),
    db.guestMealRecord.findMany({
      where: { messId, monthId, ...(memberId ? { memberId } : {}) },
      select: { memberId: true, date: true, mealType: true, guestCount: true },
    }),
  ]);

  const byMember = new Map<string, Map<string, Map<number, "ON" | "OFF">>>();
  for (const record of records) {
    const byType = byMember.get(record.memberId) ?? new Map<string, Map<number, "ON" | "OFF">>();
    const byDay = byType.get(record.mealType) ?? new Map<number, "ON" | "OFF">();
    byDay.set(dayOfMonthInDhaka(record.date), record.status);
    byType.set(record.mealType, byDay);
    byMember.set(record.memberId, byType);
  }

  const guestsByMember = new Map<string, Map<string, Map<number, number>>>();
  for (const guestRecord of guestRecords) {
    const byType = guestsByMember.get(guestRecord.memberId) ?? new Map<string, Map<number, number>>();
    const byDay = byType.get(guestRecord.mealType) ?? new Map<number, number>();
    byDay.set(dayOfMonthInDhaka(guestRecord.date), guestRecord.guestCount);
    byType.set(guestRecord.mealType, byDay);
    guestsByMember.set(guestRecord.memberId, byType);
  }

  return memberships.map((membership) => {
    const window = activeDayRange(
      { memberId: membership.id, joinedAt: membership.joinedAt, leftAt: membership.leftAt },
      month.year,
      month.month,
    );
    const days: MemberMealTimelineDay[] = [];

    for (let day = 1; day <= totalDays; day += 1) {
      const date = `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const active = day >= window.start && day <= window.end;
      const memberMeals = byMember.get(membership.id);
      const memberGuests = guestsByMember.get(membership.id);
      const values: Record<MealTypeValue, { on: boolean; guests: number; total: number }> = {
        BREAKFAST: { on: false, guests: 0, total: 0 },
        LUNCH: { on: false, guests: 0, total: 0 },
        DINNER: { on: false, guests: 0, total: 0 },
      };

      for (const mealType of MEAL_TYPES) {
        const record = memberMeals?.get(mealType)?.get(day);
        const enabled = enabledTypes.has(mealType);
        const on =
          active &&
          enabled &&
          (record === "ON" ||
            (month.status === "CLOSED" && record === undefined && (legacyClosedDefaults.get(mealType) ?? false)));
        const guests = active && enabled ? (memberGuests?.get(mealType)?.get(day) ?? 0) : 0;
        values[mealType] = { on, guests, total: (on ? 1 : 0) + guests };
      }

      days.push({
        day,
        date,
        breakfast: values.BREAKFAST.total,
        lunch: values.LUNCH.total,
        dinner: values.DINNER.total,
        breakfastOn: values.BREAKFAST.on,
        lunchOn: values.LUNCH.on,
        dinnerOn: values.DINNER.on,
        breakfastGuests: values.BREAKFAST.guests,
        lunchGuests: values.LUNCH.guests,
        dinnerGuests: values.DINNER.guests,
      });
    }

    return {
      memberId: membership.id,
      memberName: membership.displayName ?? membership.user.name,
      days,
    };
  });
}

export async function getMealCountsByMember(messId: string, monthId: string): Promise<Map<string, number>> {
  const counts = await getMealCounts(messId, monthId);
  return new Map(counts.map((c) => [c.memberId, c.total]));
}

export async function getTotalMealCount(messId: string, monthId: string): Promise<number> {
  const counts = await getMealCounts(messId, monthId);
  return counts.reduce((sum, c) => sum + c.total, 0);
}

export async function listMealRecords(messId: string, query: ListMealRecordsQuery) {
  const pagination = parsePagination(query);
  const month = query.monthId
    ? { id: query.monthId }
    : query.year && query.month
      ? await db.messMonth.findUnique({
          where: { messId_year_month: { messId, year: query.year, month: query.month } },
          select: { id: true },
        })
      : undefined;

  const where = {
    messId,
    ...(month?.id ? { monthId: month.id } : {}),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(query.date ? { date: toDateOnly(query.date) } : {}),
    ...(query.mealType ? { mealType: query.mealType } : {}),
  };

  const [total, records] = await Promise.all([
    db.mealRecord.count({ where }),
    db.mealRecord.findMany({
      where,
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return { items: records.map(toMealRecordDto), meta: paginationMeta(pagination, total) };
}

export interface DayMealStatus {
  date: string;
  settings: { mealType: string; enabled: boolean; cutoff: string; cutoffMinutes: number; closed: boolean }[];
}

/** Today's meal configuration + whether the member may still change each meal. */
export async function getDayStatus(messId: string, dateString?: string): Promise<DayMealStatus> {
  const parts = toDhakaParts();
  const dhakaToday = `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
  const target = dateString ?? dhakaToday;

  const month = await ensureMonthForDate(messId, target);
  const settings = await settingsForMonth(month.id);
  const now = new Date();

  return {
    date: target,
    settings: MEAL_TYPES.map((mealType) => {
      const setting = settings.find((s) => s.mealType === mealType);
      const cutoffMinutes = setting?.cutoffMinutes ?? 0;
        const closed = hasDhakaCutoffPassed(target, cutoffMinutes, now);
      return {
        mealType,
        enabled: setting?.enabled ?? true,
        cutoff: minutesToHhmm(cutoffMinutes),
        cutoffMinutes,
        closed,
      };
    }),
  };
}

/**
 * A member may switch a meal ON/OFF up to the exact cut-off instant. After the
 * cut-off only a manager override (with an audit record) is accepted.
 */
export async function setMealRecord(
  messId: string,
  memberId: string,
  actorUserId: string,
  _actorRole: string,
  input: SetMealRecordInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MealRecordDto> {
  const month = await ensureMonthForDate(messId, input.date);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");

  const setting = await db.mealTypeSetting.findUnique({
    where: { monthId_mealType: { monthId: month.id, mealType: input.mealType } },
  });
  if (!setting) throw AppError.notFound("Meal type is not configured for this month");
  if (!setting.enabled) throw AppError.business("This meal is disabled for the month");

  if (hasDhakaCutoffPassed(input.date, setting.cutoffMinutes)) {
    throw AppError.forbidden(
      `The ${input.mealType.toLowerCase()} cut-off (${minutesToHhmm(setting.cutoffMinutes)}) has passed; ask a manager to change it`,
    );
  }

  return upsertMealRecord(messId, month.id, memberId, actorUserId, input, "MEMBER", ctx);
}

async function upsertMealRecord(
  messId: string,
  monthId: string,
  memberId: string,
  actorUserId: string,
  input: SetMealRecordInput,
  source: "MEMBER" | "MANAGER_OVERRIDE" | "SYSTEM_DEFAULT",
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MealRecordDto> {
  const dateOnly = toDateOnly(input.date);
  const record = await db.$transaction(async (tx) => {
    const saved = await tx.mealRecord.upsert({
      where: {
        messId_memberId_date_mealType: { messId, memberId, date: dateOnly, mealType: input.mealType },
      },
      create: {
        messId,
        monthId,
        memberId,
        date: dateOnly,
        mealType: input.mealType,
        status: input.status,
        source,
        changedById: actorUserId,
        changedAt: new Date(),
      },
      update: {
        status: input.status,
        source,
        changedById: actorUserId,
        changedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MealRecord",
      entityId: saved.id,
      action: source === "MANAGER_OVERRIDE" ? "MEAL_OVERRIDE" : "MEAL_CHANGE",
      after: { memberId, date: input.date, mealType: input.mealType, status: input.status, source },
      ...ctx,
    });

    return saved;
  });

  return toMealRecordDto(record);
}

export async function overrideMealRecord(
  messId: string,
  actorUserId: string,
  input: OverrideMealRecordInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MealRecordDto> {
  const month = await ensureMonthForDate(messId, input.date);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");
  const member = await db.messMembership.findFirst({ where: { id: input.memberId, messId }, select: { id: true } });
  if (!member) throw AppError.notFound("Member not found in this mess");

  return db.$transaction(async (tx) => {
    const saved = await tx.mealRecord.upsert({
      where: {
        messId_memberId_date_mealType: { messId, memberId: input.memberId, date: toDateOnly(input.date), mealType: input.mealType },
      },
      create: {
        messId,
        monthId: month.id,
        memberId: input.memberId,
        date: toDateOnly(input.date),
        mealType: input.mealType,
        status: input.status,
        source: "MANAGER_OVERRIDE",
        changedById: actorUserId,
        changedAt: new Date(),
      },
      update: { status: input.status, source: "MANAGER_OVERRIDE", changedById: actorUserId, changedAt: new Date() },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MealRecord",
      entityId: saved.id,
      action: "MEAL_OVERRIDE",
      after: { memberId: input.memberId, date: input.date, mealType: input.mealType, status: input.status },
      reason: input.reason,
      ...ctx,
    });

    return saved;
  }).then(toMealRecordDto);
}

export async function bulkSetMealRecords(
  messId: string,
  actorUserId: string,
  input: BulkMealRecordInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ updated: number }> {
  const month = await ensureMonthForDate(messId, input.date);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");
  const dateOnly = toDateOnly(input.date);

  const members = await db.messMembership.findMany({
    where: { messId, id: { in: input.memberIds } },
    select: { id: true },
  });
  if (members.length !== input.memberIds.length) throw AppError.badRequest("One or more members were not found in this mess");

  await db.$transaction(async (tx) => {
    for (const member of members) {
      await tx.mealRecord.upsert({
        where: { messId_memberId_date_mealType: { messId, memberId: member.id, date: dateOnly, mealType: input.mealType } },
        create: {
          messId,
          monthId: month.id,
          memberId: member.id,
          date: dateOnly,
          mealType: input.mealType,
          status: input.status,
          source: "MANAGER_OVERRIDE",
          changedById: actorUserId,
          changedAt: new Date(),
        },
        update: { status: input.status, source: "MANAGER_OVERRIDE", changedById: actorUserId, changedAt: new Date() },
      });
    }

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MealRecord",
      entityId: month.id,
      action: "MEAL_BULK_OVERRIDE",
      after: { date: input.date, mealType: input.mealType, status: input.status, memberCount: members.length },
      reason: input.reason,
      ...ctx,
    });
  });

  return { updated: members.length };
}

export async function setGuestMealCount(
  messId: string,
  actorUserId: string,
  input: GuestMealInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<GuestMealDto> {
  const month = await ensureMonthForDate(messId, input.date);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");

  const setting = await db.mealTypeSetting.findUnique({
    where: { monthId_mealType: { monthId: month.id, mealType: input.mealType } },
  });
  if (!setting) throw AppError.notFound("Meal type is not configured for this month");
  if (!setting.enabled) throw AppError.business("This meal is disabled for the month");

  const member = await db.messMembership.findFirst({
    where: { id: input.memberId, messId },
    select: { id: true },
  });
  if (!member) throw AppError.notFound("Member not found in this mess");

  const date = toDateOnly(input.date);
  const unique = {
    messId_memberId_date_mealType: {
      messId,
      memberId: input.memberId,
      date,
      mealType: input.mealType,
    },
  };
  const current = await db.guestMealRecord.findUnique({ where: unique });
  if (current?.guestCount === input.guestCount || (!current && input.guestCount === 0)) {
    return { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: input.guestCount };
  }

  await db.$transaction(async (tx) => {
    if (input.guestCount === 0 && current) {
      await tx.guestMealRecord.delete({ where: { id: current.id } });
      await writeAuditLog(tx, {
        messId,
        actorUserId,
        entityType: "GuestMealRecord",
        entityId: current.id,
        action: "GUEST_MEAL_CHANGE",
        before: { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: current.guestCount },
        after: { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: 0 },
        reason: input.reason,
        ...ctx,
      });
      return;
    }

    const record = await tx.guestMealRecord.upsert({
      where: unique,
      create: {
        messId,
        monthId: month.id,
        memberId: input.memberId,
        date,
        mealType: input.mealType,
        guestCount: input.guestCount,
        changedById: actorUserId,
        changedAt: new Date(),
      },
      update: {
        guestCount: input.guestCount,
        changedById: actorUserId,
        changedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GuestMealRecord",
      entityId: record.id,
      action: "GUEST_MEAL_CHANGE",
      before: current
        ? { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: current.guestCount }
        : undefined,
      after: { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: input.guestCount },
      reason: input.reason,
      ...ctx,
    });
  });

  return { memberId: input.memberId, date: input.date, mealType: input.mealType, guestCount: input.guestCount };
}

export async function overrideMealMonth(
  messId: string,
  actorUserId: string,
  input: MonthMealOverrideInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ updated: number }> {
  const month = await loadMonthOrThrow(messId, input.monthId);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");
  const monthPrefix = `${month.year}-${String(month.month).padStart(2, "0")}-`;
  if (input.records.some((record) => !record.date.startsWith(monthPrefix))) {
    throw AppError.badRequest("Every meal date must be in the selected month");
  }

  const member = await db.messMembership.findFirst({
    where: { id: input.memberId, messId },
    select: { id: true },
  });
  if (!member) throw AppError.notFound("Member not found in this mess");

  await db.$transaction(async (tx) => {
    for (const entry of input.records) {
      const date = toDateOnly(entry.date);
      await tx.mealRecord.upsert({
        where: {
          messId_memberId_date_mealType: {
            messId,
            memberId: input.memberId,
            date,
            mealType: entry.mealType,
          },
        },
        create: {
          messId,
          monthId: month.id,
          memberId: input.memberId,
          date,
          mealType: entry.mealType,
          status: entry.status,
          source: "MANAGER_OVERRIDE",
          changedById: actorUserId,
          changedAt: new Date(),
        },
        update: {
          status: entry.status,
          source: "MANAGER_OVERRIDE",
          changedById: actorUserId,
          changedAt: new Date(),
        },
      });
    }

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MessMonth",
      entityId: month.id,
      action: "MEAL_MONTH_OVERRIDE",
      after: { memberId: input.memberId, updatedRecords: input.records.length },
      reason: input.reason,
      ...ctx,
    });
  });

  return { updated: input.records.length };
}

export async function deleteMealRecord(
  messId: string,
  recordId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const record = await db.mealRecord.findFirst({ where: { id: recordId, messId } });
  if (!record) throw AppError.notFound("Meal record not found");
  const month = await loadMonthOrThrow(messId, record.monthId);
  if (month.status === "CLOSED") throw AppError.business("This month is closed; meals can no longer change");

  await db.$transaction(async (tx) => {
    await tx.mealRecord.delete({ where: { id: recordId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "MealRecord",
      entityId: recordId,
      action: "MEAL_RESET",
      before: { memberId: record.memberId, date: fromDateOnly(record.date), mealType: record.mealType, status: record.status },
      ...ctx,
    });
  });

  return { id: recordId };
}

export { ensureMonth };
