import type { BazarEntry, BazarEntryItem } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly, toDateOnly } from "../../app/utils/date.ts";
import { multiplyPoishaByQuantity, poishaToTakaString } from "../../app/utils/money.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { assertMonthOpen, ensureMonth } from "../months/months.service.ts";
import type {
  BazarItemInput,
  CreateBazarEntryInput,
  ListBazarEntriesQuery,
  RejectBazarEntryInput,
  UpdateBazarEntryInput,
} from "./bazar.schema.ts";

export interface BazarItemDto {
  id: string;
  groceryItemId: string | null;
  itemNameSnapshot: string;
  itemNameBnSnapshot: string | null;
  unitSnapshot: string;
  quantity: string;
  unitPricePoisha: string;
  unitPriceTaka: string;
  lineTotalPoisha: string;
  lineTotalTaka: string;
  confidence: number | null;
  source: string | null;
}

export interface BazarEntryDto {
  id: string;
  messId: string;
  monthId: string;
  buyerMemberId: string;
  buyerName: string | null;
  purchaseDate: string;
  shopName: string | null;
  totalPoisha: string;
  totalTaka: string;
  paymentMethod: string;
  notes: string | null;
  status: string;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  expenseId: string | null;
  itemCount: number;
  items?: BazarItemDto[];
  createdAt: string;
}

function toItemDto(item: BazarEntryItem): BazarItemDto {
  return {
    id: item.id,
    groceryItemId: item.groceryItemId,
    itemNameSnapshot: item.itemNameSnapshot,
    itemNameBnSnapshot: item.itemNameBnSnapshot,
    unitSnapshot: item.unitSnapshot,
    quantity: item.quantity.toString(),
    unitPricePoisha: item.unitPricePoisha.toString(),
    unitPriceTaka: poishaToTakaString(item.unitPricePoisha),
    lineTotalPoisha: item.lineTotalPoisha.toString(),
    lineTotalTaka: poishaToTakaString(item.lineTotalPoisha),
    confidence: item.confidence,
    source: item.source,
  };
}

type EntryRow = BazarEntry & {
  buyer?: { displayName: string | null; user?: { name: string } | null } | null;
  items?: BazarEntryItem[];
  expense?: { id: string } | null;
  _count?: { items: number };
};

const entryInclude = {
  buyer: { select: { displayName: true, user: { select: { name: true } } } },
  _count: { select: { items: true } },
} as const;

function toDto(entry: EntryRow, withItems = false): BazarEntryDto {
  return {
    id: entry.id,
    messId: entry.messId,
    monthId: entry.monthId,
    buyerMemberId: entry.buyerMemberId,
    buyerName: entry.buyer?.displayName ?? entry.buyer?.user?.name ?? null,
    purchaseDate: fromDateOnly(entry.purchaseDate),
    shopName: entry.shopName,
    totalPoisha: entry.totalPoisha.toString(),
    totalTaka: poishaToTakaString(entry.totalPoisha),
    paymentMethod: entry.paymentMethod,
    notes: entry.notes,
    status: entry.status,
    submittedAt: entry.submittedAt?.toISOString() ?? null,
    reviewedById: entry.reviewedById,
    reviewedAt: entry.reviewedAt?.toISOString() ?? null,
    rejectionReason: entry.rejectionReason,
    expenseId: entry.expense?.id ?? null,
    itemCount: entry._count?.items ?? entry.items?.length ?? 0,
    ...(withItems ? { items: (entry.items ?? []).map(toItemDto) } : {}),
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Resolves catalogue snapshots (names + unit) and computes line totals. */
async function buildItemRows(messId: string, items: BazarItemInput[]) {
  const catalogueIds = items.map((i) => i.groceryItemId).filter((id): id is string => Boolean(id));
  const catalogue =
    catalogueIds.length > 0
      ? await db.groceryItem.findMany({
          where: { id: { in: catalogueIds }, OR: [{ messId: null }, { messId }] },
        })
      : [];
  const catalogueById = new Map(catalogue.map((c) => [c.id, c]));

  if (catalogueIds.some((id) => !catalogueById.has(id))) {
    throw AppError.badRequest("One or more grocery items were not found");
  }

  return items.map((item) => {
    const source = item.groceryItemId ? catalogueById.get(item.groceryItemId) : undefined;
    const unitPricePoisha = item.unitPriceTaka;
    return {
      groceryItemId: item.groceryItemId ?? null,
      itemNameSnapshot: source?.nameEn ?? item.nameSnapshot ?? "Unknown item",
      itemNameBnSnapshot: source?.nameBn ?? item.nameBnSnapshot ?? null,
      unitSnapshot: item.unit,
      quantity: item.quantity,
      unitPricePoisha,
      lineTotalPoisha: multiplyPoishaByQuantity(unitPricePoisha, item.quantity),
      confidence: item.confidence ?? null,
      source: item.source ?? "MANAGER_ENTRY",
    };
  });
}

function sumTotals(rows: { lineTotalPoisha: bigint }[]): bigint {
  return rows.reduce((sum, row) => sum + row.lineTotalPoisha, 0n);
}

export async function listBazarEntries(
  messId: string,
  query: ListBazarEntriesQuery,
  callerMembershipId: string,
) {
  const pagination = parsePagination(query);
  let monthId = query.monthId;
  if (!monthId && query.year && query.month) {
    const month = await db.messMonth.findUnique({
      where: { messId_year_month: { messId, year: query.year, month: query.month } },
      select: { id: true },
    });
    monthId = month?.id;
  }

  const where = {
    messId,
    ...(query.status ? { status: query.status } : {}),
    ...(monthId ? { monthId } : {}),
    ...(query.mine ? { buyerMemberId: callerMembershipId } : query.buyerMemberId ? { buyerMemberId: query.buyerMemberId } : {}),
  };

  const [total, entries] = await Promise.all([
    db.bazarEntry.count({ where }),
    db.bazarEntry.findMany({
      where,
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: { ...entryInclude, expense: { select: { id: true } } },
    }),
  ]);

  return { items: entries.map((e) => toDto(e)), meta: paginationMeta(pagination, total) };
}

export async function getBazarEntry(messId: string, entryId: string): Promise<BazarEntryDto> {
  const entry = await db.bazarEntry.findFirst({
    where: { id: entryId, messId },
    include: { ...entryInclude, items: { orderBy: { createdAt: "asc" } }, expense: { select: { id: true } } },
  });
  if (!entry) throw AppError.notFound("Bazar entry not found");
  return toDto(entry, true);
}

export interface CreateBazarOptions {
  actorUserId: string;
  actorMembershipId: string;
  actorRole: string;
  ctx: Pick<AuditInput, "ip" | "userAgent">;
}

export async function createBazarEntry(
  messId: string,
  input: CreateBazarEntryInput,
  options: CreateBazarOptions,
): Promise<BazarEntryDto> {
  const buyerMemberId = input.buyerMemberId ?? options.actorMembershipId;
  if (input.buyerMemberId && input.buyerMemberId !== options.actorMembershipId && options.actorRole !== "MANAGER") {
    throw AppError.forbidden("Only a manager can submit a bazar entry for another member");
  }
  const buyer = await db.messMembership.findFirst({ where: { id: buyerMemberId, messId }, select: { id: true } });
  if (!buyer) throw AppError.notFound("Buyer membership not found in this mess");

  const month = await ensureMonth(messId, { monthId: input.monthId, year: input.year, month: input.month });
  if (month.status === "CLOSED") throw AppError.business("This month is closed; records can no longer be changed");
  const rows = await buildItemRows(messId, input.items);
  const total = sumTotals(rows);
  const status = input.submit ? "PENDING_REVIEW" : "DRAFT";

  const entry = await db.$transaction(async (tx) => {
    const createdEntry = await tx.bazarEntry.create({
      data: {
        messId,
        monthId: month.id,
        buyerMemberId,
        purchaseDate: toDateOnly(input.purchaseDate),
        shopName: input.shopName ?? null,
        totalPoisha: total,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? null,
        status,
        submittedAt: input.submit ? new Date() : null,
      },
    });

    await tx.bazarEntryItem.createMany({
      data: rows.map((row) => ({ ...row, bazarEntryId: createdEntry.id })),
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "BazarEntry",
      entityId: createdEntry.id,
      action: "CREATE",
      after: { buyerMemberId, totalPoisha: total.toString(), status, itemCount: rows.length },
      ...options.ctx,
    });

    return createdEntry;
  });

  return getBazarEntry(messId, entry.id);
}

export interface MutateBazarOptions {
  actorUserId: string;
  actorMembershipId: string;
  actorRole: string;
  ctx: Pick<AuditInput, "ip" | "userAgent">;
}

export async function updateBazarEntry(
  messId: string,
  entryId: string,
  input: UpdateBazarEntryInput,
  options: MutateBazarOptions,
): Promise<BazarEntryDto> {
  const before = await db.bazarEntry.findFirst({ where: { id: entryId, messId }, include: { items: true } });
  if (!before) throw AppError.notFound("Bazar entry not found");
  await assertMonthOpen(messId, before.monthId);
  if (before.status === "APPROVED") throw AppError.business("An approved bazar entry cannot be edited; reverse the linked expense instead");
  if (options.actorRole !== "MANAGER" && before.buyerMemberId !== options.actorMembershipId) {
    throw AppError.forbidden("You can only edit your own bazar entries");
  }
  if (before.status === "REJECTED" && options.actorRole !== "MANAGER") {
    throw AppError.business("A rejected bazar entry cannot be edited");
  }

  const rows = input.items ? await buildItemRows(messId, input.items) : null;
  const total = rows ? sumTotals(rows) : before.totalPoisha;

  await db.$transaction(async (tx) => {
    await tx.bazarEntry.update({
      where: { id: entryId },
      data: {
        ...(input.purchaseDate !== undefined ? { purchaseDate: toDateOnly(input.purchaseDate) } : {}),
        ...(input.shopName !== undefined ? { shopName: input.shopName } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(rows ? { totalPoisha: total } : {}),
      },
    });

    if (rows) {
      await tx.bazarEntryItem.deleteMany({ where: { bazarEntryId: entryId } });
      await tx.bazarEntryItem.createMany({ data: rows.map((row) => ({ ...row, bazarEntryId: entryId })) });
    }

    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "BazarEntry",
      entityId: entryId,
      action: "UPDATE",
      before: { totalPoisha: before.totalPoisha.toString(), itemCount: before.items.length },
      after: { totalPoisha: total.toString(), itemCount: rows?.length ?? before.items.length },
      ...options.ctx,
    });
  });

  return getBazarEntry(messId, entryId);
}

export async function submitBazarEntry(
  messId: string,
  entryId: string,
  options: MutateBazarOptions,
): Promise<BazarEntryDto> {
  const entry = await db.bazarEntry.findFirst({ where: { id: entryId, messId } });
  if (!entry) throw AppError.notFound("Bazar entry not found");
  await assertMonthOpen(messId, entry.monthId);
  if (entry.status !== "DRAFT") throw AppError.business(`Only a draft can be submitted (current: ${entry.status})`);
  if (options.actorRole !== "MANAGER" && entry.buyerMemberId !== options.actorMembershipId) {
    throw AppError.forbidden("You can only submit your own bazar entries");
  }

  await db.$transaction(async (tx) => {
    await tx.bazarEntry.update({ where: { id: entryId }, data: { status: "PENDING_REVIEW", submittedAt: new Date() } });
    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "BazarEntry",
      entityId: entryId,
      action: "SUBMIT",
      before: { status: entry.status },
      after: { status: "PENDING_REVIEW" },
      ...options.ctx,
    });
  });

  return getBazarEntry(messId, entryId);
}

/**
 * Approves a bazar entry, posts a matching APPROVED expense to the ledger, and
 * records verified purchase prices for each item. Only approved entries count
 * toward confirmed expenses and official reports.
 */
export async function approveBazarEntry(
  messId: string,
  entryId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<BazarEntryDto> {
  const entry = await db.bazarEntry.findFirst({ where: { id: entryId, messId }, include: { items: true, expense: true } });
  if (!entry) throw AppError.notFound("Bazar entry not found");
  await assertMonthOpen(messId, entry.monthId);
  if (entry.status === "APPROVED") throw AppError.conflict("This bazar entry is already approved");
  if (entry.items.length === 0) throw AppError.business("A bazar entry with no items cannot be approved");
  if (entry.expense) throw AppError.conflict("An expense is already linked to this bazar entry");

  await db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        messId,
        monthId: entry.monthId,
        category: "MEAL_BAZAR",
        amountPoisha: entry.totalPoisha,
        description: `Bazar purchase on ${fromDateOnly(entry.purchaseDate)}${entry.shopName ? ` (${entry.shopName})` : ""}`,
        allocationMethod: "EQUAL",
        status: "APPROVED",
        incurredOn: entry.purchaseDate,
        createdById: entry.buyerMemberId,
        approvedById: actorUserId,
        approvedAt: new Date(),
        bazarEntryId: entry.id,
      },
    });

    await tx.bazarEntry.update({
      where: { id: entryId },
      data: { status: "APPROVED", reviewedById: actorUserId, reviewedAt: new Date(), rejectionReason: null },
    });

    // Verified purchase prices become the source of truth for each item.
    await Promise.all(
      entry.items
        .filter((item) => item.groceryItemId)
        .map((item) =>
          tx.groceryPrice.create({
            data: {
              messId,
              groceryItemId: item.groceryItemId as string,
              pricePoisha: item.unitPricePoisha,
              unit: item.unitSnapshot,
              source: "VERIFIED_PURCHASE",
              verification: "VERIFIED",
              shopName: entry.shopName,
              observedOn: entry.purchaseDate,
              enteredById: actorUserId,
            },
          }),
        ),
    );

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarEntry",
      entityId: entryId,
      action: "APPROVE",
      before: { status: entry.status },
      after: { status: "APPROVED", expenseId: expense.id },
      ...ctx,
    });
  });

  return getBazarEntry(messId, entryId);
}

export async function rejectBazarEntry(
  messId: string,
  entryId: string,
  actorUserId: string,
  input: RejectBazarEntryInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<BazarEntryDto> {
  const entry = await db.bazarEntry.findFirst({ where: { id: entryId, messId } });
  if (!entry) throw AppError.notFound("Bazar entry not found");
  await assertMonthOpen(messId, entry.monthId);
  if (entry.status === "APPROVED") throw AppError.business("An approved bazar entry cannot be rejected");
  if (entry.status === "REJECTED") throw AppError.conflict("This bazar entry is already rejected");

  await db.$transaction(async (tx) => {
    await tx.bazarEntry.update({
      where: { id: entryId },
      data: { status: "REJECTED", reviewedById: actorUserId, reviewedAt: new Date(), rejectionReason: input.reason },
    });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "BazarEntry",
      entityId: entryId,
      action: "REJECT",
      before: { status: entry.status },
      after: { status: "REJECTED" },
      reason: input.reason,
      ...ctx,
    });
  });

  return getBazarEntry(messId, entryId);
}

export async function deleteBazarEntry(
  messId: string,
  entryId: string,
  options: MutateBazarOptions,
): Promise<{ id: string }> {
  const entry = await db.bazarEntry.findFirst({ where: { id: entryId, messId } });
  if (!entry) throw AppError.notFound("Bazar entry not found");
  await assertMonthOpen(messId, entry.monthId);
  if (entry.status !== "DRAFT") throw AppError.business("Only a draft bazar entry can be deleted");
  if (options.actorRole !== "MANAGER" && entry.buyerMemberId !== options.actorMembershipId) {
    throw AppError.forbidden("You can only delete your own draft");
  }

  await db.$transaction(async (tx) => {
    await tx.bazarEntry.delete({ where: { id: entryId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId: options.actorUserId,
      entityType: "BazarEntry",
      entityId: entryId,
      action: "DELETE",
      before: { totalPoisha: entry.totalPoisha.toString(), status: entry.status },
      ...options.ctx,
    });
  });

  return { id: entryId };
}
