import type { DailyMenu } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly, toDateOnly } from "../../app/utils/date.ts";
import { ensureMonthForDate } from "../months/months.service.ts";
import type { ListMenusQuery, UpsertMenuInput } from "./meals.schema.ts";

export interface MenuDto {
  id: string;
  date: string;
  mealType: string;
  menuText: string;
  noticeText: string | null;
  updatedById: string | null;
}

function toDto(menu: DailyMenu): MenuDto {
  return {
    id: menu.id,
    date: fromDateOnly(menu.date),
    mealType: menu.mealType,
    menuText: menu.menuText,
    noticeText: menu.noticeText,
    updatedById: menu.updatedById,
  };
}

export async function listMenus(messId: string, query: ListMenusQuery): Promise<MenuDto[]> {
  let monthId = query.monthId;
  if (!monthId && query.year && query.month) {
    const month = await db.messMonth.findUnique({
      where: { messId_year_month: { messId, year: query.year, month: query.month } },
      select: { id: true },
    });
    monthId = month?.id;
  }

  const menus = await db.dailyMenu.findMany({
    where: {
      messId,
      ...(monthId ? { monthId } : {}),
      ...(query.mealType ? { mealType: query.mealType } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: toDateOnly(query.from) } : {}),
              ...(query.to ? { lte: toDateOnly(query.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  return menus.map(toDto);
}

export async function upsertMenu(
  messId: string,
  actorUserId: string,
  input: UpsertMenuInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MenuDto> {
  const month = await ensureMonthForDate(messId, input.date);
  const dateOnly = toDateOnly(input.date);

  const saved = await db.$transaction(async (tx) => {
    const menu = await tx.dailyMenu.upsert({
      where: { messId_date_mealType: { messId, date: dateOnly, mealType: input.mealType } },
      create: {
        messId,
        monthId: month.id,
        date: dateOnly,
        mealType: input.mealType,
        menuText: input.menuText,
        noticeText: input.noticeText ?? null,
        updatedById: actorUserId,
      },
      update: { menuText: input.menuText, noticeText: input.noticeText ?? null, updatedById: actorUserId },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "DailyMenu",
      entityId: menu.id,
      action: "UPSERT",
      after: { date: input.date, mealType: input.mealType, menuText: input.menuText },
      ...ctx,
    });

    return menu;
  });

  return toDto(saved);
}

export async function deleteMenu(
  messId: string,
  menuId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const menu = await db.dailyMenu.findFirst({ where: { id: menuId, messId } });
  if (!menu) throw AppError.notFound("Menu not found");

  await db.$transaction(async (tx) => {
    await tx.dailyMenu.delete({ where: { id: menuId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "DailyMenu",
      entityId: menuId,
      action: "DELETE",
      before: { date: fromDateOnly(menu.date), mealType: menu.mealType, menuText: menu.menuText },
      ...ctx,
    });
  });

  return { id: menuId };
}
