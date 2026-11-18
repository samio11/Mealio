import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { paginationMeta, type Pagination } from "../../app/utils/pagination.ts";
import { cleanupMessCloudinaryAssets } from "../media/media.service.ts";
import type { AdminListQuery } from "./admin.schema.ts";

function listPagination(query: AdminListQuery): Pagination {
  return {
    page: query.page,
    pageSize: query.pageSize,
    take: query.pageSize,
    skip: (query.page - 1) * query.pageSize,
  };
}

function searchText(query: AdminListQuery) {
  if (!query.q) return undefined;
  return {
    contains: query.q,
    mode: "insensitive" as const,
  };
}

export async function getAdminOverview() {
  const [users, admins, messes, archivedMesses, activeMemberships] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { platformRole: "ADMIN" } }),
    db.mess.count(),
    db.mess.count({ where: { archivedAt: { not: null } } }),
    db.messMembership.count({ where: { status: "ACTIVE" } }),
  ]);
  return { users, admins, messes, archivedMesses, activeMemberships };
}

export async function listAdminUsers(query: AdminListQuery) {
  const pagination = listPagination(query);
  const text = searchText(query);
  const where = text
    ? { OR: [{ name: text }, { email: text }, { phone: text }] }
    : undefined;
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: { _count: { select: { memberships: true, createdMesses: true } } },
    }),
    db.user.count({ where }),
  ]);

  return { items, meta: paginationMeta(pagination, total) };
}

export async function getAdminUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        orderBy: { joinedAt: "desc" },
        include: { mess: { select: { id: true, name: true, area: true, archivedAt: true } } },
      },
      _count: { select: { memberships: true, createdMesses: true } },
    },
  });
  if (!user) throw AppError.notFound("User not found");

  const { memberships, ...profile } = user;
  return {
    ...profile,
    memberships: memberships.map(({ mess, ...membership }) => ({
      ...membership,
      mess: { ...mess, archived: mess.archivedAt !== null, archivedAt: undefined },
    })),
  };
}

export async function updatePlatformRole(
  actorUserId: string,
  targetUserId: string,
  nextRole: "USER" | "ADMIN",
) {
  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, platformRole: true },
    });
    if (!target) throw AppError.notFound("User not found");
    if (target.platformRole === nextRole) return target;

    if (actorUserId === targetUserId && nextRole !== "ADMIN") {
      throw AppError.business("You cannot remove your own platform administrator role");
    }

    if (target.platformRole === "ADMIN" && nextRole === "USER") {
      const admins = await tx.user.count({ where: { platformRole: "ADMIN" } });
      if (admins <= 1) throw AppError.business("At least one platform administrator must remain");
    }

    return tx.user.update({
      where: { id: targetUserId },
      data: { platformRole: nextRole },
      select: { id: true, platformRole: true },
    });
  });
}

export async function listAdminMesses(query: AdminListQuery) {
  const pagination = listPagination(query);
  const text = searchText(query);
  const where = text
    ? {
        OR: [
          { name: text },
          { area: text },
          { createdBy: { name: text } },
          { createdBy: { email: text } },
        ],
      }
    : undefined;
  const [items, total] = await Promise.all([
    db.mess.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            memberships: true,
            invitations: true,
            months: true,
            groceryItems: true,
            groceryPrices: true,
            deposits: true,
            expenses: true,
            bazarEntries: true,
            duties: true,
            menus: true,
            mealRecords: true,
            media: true,
            aiExtractions: true,
            adjustments: true,
            auditLogs: true,
          },
        },
      },
    }),
    db.mess.count({ where }),
  ]);
  return { items, meta: paginationMeta(pagination, total) };
}

export async function getAdminMess(messId: string) {
  const mess = await db.mess.findUnique({
    where: { id: messId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      memberships: {
        orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
        include: {
          user: { select: { id: true, name: true, email: true, image: true, phone: true } },
        },
      },
      months: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          _count: {
            select: {
              mealSettings: true,
              mealRecords: true,
              menus: true,
              deposits: true,
              expenses: true,
              bazarEntries: true,
              duties: true,
              adjustments: true,
            },
          },
        },
      },
      _count: {
        select: {
          memberships: true,
          invitations: true,
          months: true,
          groceryItems: true,
          groceryPrices: true,
          deposits: true,
          expenses: true,
          bazarEntries: true,
          duties: true,
          menus: true,
          mealRecords: true,
          media: true,
          aiExtractions: true,
          adjustments: true,
          auditLogs: true,
        },
      },
    },
  });
  if (!mess) throw AppError.notFound("Mess not found");

  const [depositTotal, expenseTotal, bazarTotal] = await Promise.all([
    db.deposit.aggregate({ where: { messId }, _sum: { amountPoisha: true } }),
    db.expense.aggregate({ where: { messId }, _sum: { amountPoisha: true } }),
    db.bazarEntry.aggregate({ where: { messId }, _sum: { totalPoisha: true } }),
  ]);
  return {
    ...mess,
    archived: mess.archivedAt !== null,
    memberships: mess.memberships.map(({ user, ...membership }) => ({
      ...membership,
      user,
    })),
    months: mess.months.map((month) => ({
      ...month,
      openingCashPoisha: month.openingCashPoisha.toString(),
      budgetPoisha: month.budgetPoisha.toString(),
    })),
    totals: {
      depositsPoisha: (depositTotal._sum.amountPoisha ?? 0n).toString(),
      expensesPoisha: (expenseTotal._sum.amountPoisha ?? 0n).toString(),
      bazarPoisha: (bazarTotal._sum.totalPoisha ?? 0n).toString(),
    },
  };
}

export async function deleteAdminMess(messId: string, confirmationName: string) {
  const result = await db.$transaction(async (tx) => {
    const mess = await tx.mess.findUnique({
      where: { id: messId },
      select: { id: true, name: true },
    });
    if (!mess) throw AppError.notFound("Mess not found");
    if (mess.name !== confirmationName) {
      throw AppError.badRequest("The confirmation name does not match this mess");
    }

    const [mediaAssets, monthIds, expenseIds, bazarEntryIds] = await Promise.all([
      tx.media.findMany({
        where: { messId, provider: "cloudinary" },
        select: { publicId: true, resourceType: true },
      }),
      tx.messMonth.findMany({ where: { messId }, select: { id: true } }).then((rows) => rows.map((row) => row.id)),
      tx.expense.findMany({ where: { messId }, select: { id: true } }).then((rows) => rows.map((row) => row.id)),
      tx.bazarEntry.findMany({ where: { messId }, select: { id: true } }).then((rows) => rows.map((row) => row.id)),
    ]);

    if (expenseIds.length > 0) {
      await tx.expense.updateMany({
        where: { reversalOfId: { in: expenseIds } },
        data: { reversalOfId: null },
      });
    }

    await tx.expenseAllocation.deleteMany({ where: { expenseId: { in: expenseIds } } });
    await tx.mealRecord.deleteMany({ where: { messId } });
    await tx.deposit.deleteMany({ where: { messId } });
    await tx.memberAdjustment.deleteMany({ where: { messId } });
    await tx.bazarEntryItem.deleteMany({ where: { bazarEntryId: { in: bazarEntryIds } } });
    await tx.groceryPrice.deleteMany({ where: { messId } });
    await tx.dailyMenu.deleteMany({ where: { messId } });
    await tx.mealTypeSetting.deleteMany({ where: { monthId: { in: monthIds } } });
    await tx.bazarDuty.deleteMany({ where: { messId } });
    await tx.media.deleteMany({ where: { messId } });
    await tx.aIExtraction.deleteMany({ where: { messId } });
    await tx.expense.deleteMany({ where: { messId } });
    await tx.bazarEntry.deleteMany({ where: { messId } });
    await tx.groceryItem.deleteMany({ where: { messId } });
    await tx.messInvitation.deleteMany({ where: { messId } });
    await tx.auditLog.deleteMany({ where: { messId } });
    await tx.messMonth.deleteMany({ where: { messId } });
    await tx.messMembership.deleteMany({ where: { messId } });
    await tx.mess.delete({ where: { id: messId } });

    return { id: mess.id, name: mess.name, deleted: true as const, mediaAssets };
  }, { timeout: 30_000 });

  const storageCleanupFailures = await cleanupMessCloudinaryAssets(result.mediaAssets, messId);
  return {
    id: result.id,
    name: result.name,
    deleted: result.deleted,
    storageCleanupFailures,
  };
}
