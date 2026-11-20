import type { GroceryPrice } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly, toDateOnly } from "../../app/utils/date.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import type { CreatePriceInput, ListPricesQuery, UpdatePriceInput } from "./grocery-prices.schema.ts";

export interface PriceDto {
  id: string;
  groceryItemId: string;
  itemNameEn: string | null;
  itemNameBn: string | null;
  pricePoisha: string;
  priceTaka: string;
  unit: string;
  source: string;
  verification: string;
  shopName: string | null;
  location: string | null;
  observedOn: string;
  enteredById: string;
  createdAt: string;
}

type PriceRow = GroceryPrice & { groceryItem?: { nameEn: string; nameBn: string } | null };

function toDto(price: PriceRow): PriceDto {
  return {
    id: price.id,
    groceryItemId: price.groceryItemId,
    itemNameEn: price.groceryItem?.nameEn ?? null,
    itemNameBn: price.groceryItem?.nameBn ?? null,
    pricePoisha: price.pricePoisha.toString(),
    priceTaka: (Number(price.pricePoisha) / 100).toFixed(2),
    unit: price.unit,
    source: price.source,
    verification: price.verification,
    shopName: price.shopName,
    location: price.location,
    observedOn: fromDateOnly(price.observedOn),
    enteredById: price.enteredById,
    createdAt: price.createdAt.toISOString(),
  };
}

const priceInclude = { groceryItem: { select: { nameEn: true, nameBn: true } } } as const;

async function assertItemAccessible(messId: string, groceryItemId: string): Promise<void> {
  const item = await db.groceryItem.findFirst({
    where: { id: groceryItemId, OR: [{ messId: null }, { messId }] },
    select: { id: true },
  });
  if (!item) throw AppError.notFound("Grocery item not found");
}

export async function listPrices(messId: string, query: ListPricesQuery) {
  const pagination = parsePagination(query);
  const where = {
    messId,
    ...(query.groceryItemId ? { groceryItemId: query.groceryItemId } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.verification ? { verification: query.verification } : {}),
    ...(query.from || query.to
      ? {
          observedOn: {
            ...(query.from ? { gte: toDateOnly(query.from) } : {}),
            ...(query.to ? { lte: toDateOnly(query.to) } : {}),
          },
        }
      : {}),
  };

  const [total, prices] = await Promise.all([
    db.groceryPrice.count({ where }),
    db.groceryPrice.findMany({
      where,
      orderBy: [{ observedOn: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: priceInclude,
    }),
  ]);

  return { items: prices.map(toDto), meta: paginationMeta(pagination, total) };
}

/** The most recent observation for each of the mess's items (used by the UI "current price" list). */
export async function listLatestPrices(messId: string) {
  const prices = await db.groceryPrice.findMany({
    where: { messId },
    orderBy: [{ observedOn: "desc" }, { createdAt: "desc" }],
    include: priceInclude,
  });
  const seen = new Set<string>();
  const latest: PriceDto[] = [];
  for (const price of prices) {
    if (seen.has(price.groceryItemId)) continue;
    seen.add(price.groceryItemId);
    latest.push(toDto(price));
  }
  return latest;
}

export async function getLatestPriceForItem(messId: string, groceryItemId: string): Promise<PriceDto | null> {
  const price = await db.groceryPrice.findFirst({
    where: { messId, groceryItemId },
    orderBy: [{ observedOn: "desc" }, { createdAt: "desc" }],
    include: priceInclude,
  });
  return price ? toDto(price) : null;
}

export async function createPrice(
  messId: string,
  actorUserId: string,
  input: CreatePriceInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<PriceDto> {
  await assertItemAccessible(messId, input.groceryItemId);
  if (input.priceTaka < 0n) throw AppError.badRequest("Price cannot be negative");

  const price = await db.$transaction(async (tx) => {
    const createdPrice = await tx.groceryPrice.create({
      data: {
        messId,
        groceryItemId: input.groceryItemId,
        pricePoisha: input.priceTaka,
        unit: input.unit,
        source: input.source,
        verification: input.source === "VERIFIED_PURCHASE" ? "VERIFIED" : "UNVERIFIED",
        shopName: input.shopName ?? null,
        location: input.location ?? null,
        observedOn: toDateOnly(input.observedOn),
        enteredById: actorUserId,
      },
      include: priceInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryPrice",
      entityId: createdPrice.id,
      action: "CREATE",
      after: { groceryItemId: input.groceryItemId, pricePoisha: input.priceTaka.toString(), source: input.source },
      ...ctx,
    });

    return createdPrice;
  });

  return toDto(price);
}

export async function updatePriceVerification(
  messId: string,
  priceId: string,
  actorUserId: string,
  input: UpdatePriceInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<PriceDto> {
  const before = await db.groceryPrice.findFirst({ where: { id: priceId, messId } });
  if (!before) throw AppError.notFound("Price observation not found");

  const price = await db.$transaction(async (tx) => {
    const updated = await tx.groceryPrice.update({
      where: { id: priceId },
      data: {
        ...(input.priceTaka !== undefined ? { pricePoisha: input.priceTaka } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.verification !== undefined ? { verification: input.verification } : {}),
        ...(input.shopName !== undefined ? { shopName: input.shopName } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.observedOn !== undefined ? { observedOn: toDateOnly(input.observedOn) } : {}),
      },
      include: priceInclude,
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryPrice",
      entityId: priceId,
      action: "UPDATE",
      before: { pricePoisha: before.pricePoisha.toString(), verification: before.verification },
      after: { pricePoisha: updated.pricePoisha.toString(), verification: updated.verification },
      ...ctx,
    });

    return updated;
  });

  return toDto(price);
}

export async function deletePrice(
  messId: string,
  priceId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const price = await db.groceryPrice.findFirst({ where: { id: priceId, messId } });
  if (!price) throw AppError.notFound("Price observation not found");

  await db.$transaction(async (tx) => {
    await tx.groceryPrice.delete({ where: { id: priceId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryPrice",
      entityId: priceId,
      action: "DELETE",
      before: { groceryItemId: price.groceryItemId, pricePoisha: price.pricePoisha.toString() },
      ...ctx,
    });
  });

  return { id: priceId };
}
