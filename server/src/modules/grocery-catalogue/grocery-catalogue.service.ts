import type { GroceryItem, GroceryMasterPrice } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import { CATALOGUE_SEED } from "./catalogue.data.ts";
import type {
  CreateGroceryItemInput,
  ListCatalogueQuery,
  UpdateGroceryItemInput,
} from "./grocery-catalogue.schema.ts";

export interface GroceryItemDto {
  id: string;
  nameEn: string;
  nameBn: string;
  aliases: string[];
  category: string;
  unit: string;
  brand: string | null;
  isActive: boolean;
  isCustom: boolean;
  /** Latest observed price for this mess, if any. */
  latestPricePoisha: string | null;
  latestPriceSource: string | null;
  latestPriceObservedOn: string | null;
  masterPrice: {
    sourceItemId: string;
    unitLabel: string;
    minPricePoisha: string;
    maxPricePoisha: string;
    referencePricePoisha: string;
    sourceNote: string;
    sourceUrl: string;
    checkedOn: string;
    priceType: string;
    isActive: boolean;
    notes: string;
  } | null;
}

function toDto(
  item: GroceryItem,
  price?: { pricePoisha: bigint; source: string; observedOn: Date } | undefined,
  masterPrice?: GroceryMasterPrice | null,
): GroceryItemDto {
  return {
    id: item.id,
    nameEn: item.nameEn,
    nameBn: item.nameBn,
    aliases: item.aliases,
    category: item.category,
    unit: item.unit,
    brand: item.brand,
    isActive: item.isActive,
    isCustom: item.isCustom,
    latestPricePoisha: price ? price.pricePoisha.toString() : null,
    latestPriceSource: price ? price.source : null,
    latestPriceObservedOn: price ? price.observedOn.toISOString().slice(0, 10) : null,
    masterPrice: masterPrice
      ? {
          sourceItemId: masterPrice.sourceItemId,
          unitLabel: masterPrice.unitLabel,
          minPricePoisha: masterPrice.minPricePoisha.toString(),
          maxPricePoisha: masterPrice.maxPricePoisha.toString(),
          referencePricePoisha: masterPrice.referencePricePoisha.toString(),
          sourceNote: masterPrice.sourceNote,
          sourceUrl: masterPrice.sourceUrl,
          checkedOn: masterPrice.checkedOn.toISOString().slice(0, 10),
          priceType: masterPrice.priceType,
          isActive: masterPrice.isActive,
          notes: masterPrice.notes,
        }
      : null,
  };
}

/** Latest observed price per grocery item for a mess. */
async function latestPricesFor(
  messId: string,
  itemIds: string[],
): Promise<Map<string, { pricePoisha: bigint; source: string; observedOn: Date }>> {
  if (itemIds.length === 0) return new Map();
  const prices = await db.groceryPrice.findMany({
    where: { messId, groceryItemId: { in: itemIds } },
    orderBy: [{ observedOn: "desc" }, { createdAt: "desc" }],
    select: { groceryItemId: true, pricePoisha: true, source: true, observedOn: true },
  });
  const map = new Map<string, { pricePoisha: bigint; source: string; observedOn: Date }>();
  for (const price of prices) {
    if (!map.has(price.groceryItemId)) {
      map.set(price.groceryItemId, {
        pricePoisha: price.pricePoisha,
        source: price.source,
        observedOn: price.observedOn,
      });
    }
  }
  return map;
}

async function masterPricesFor(itemIds: string[]): Promise<Map<string, GroceryMasterPrice>> {
  if (itemIds.length === 0) return new Map();
  const prices = await db.groceryMasterPrice.findMany({
    where: { groceryItemId: { in: itemIds } },
  });
  return new Map(prices.map((price) => [price.groceryItemId, price]));
}

export async function listCatalogue(messId: string, query: ListCatalogueQuery) {
  const pagination = parsePagination(query);

  const where = {
    ...(query.customOnly ? { messId } : { OR: [{ messId: null }, { messId }] }),
    ...(query.category ? { category: query.category } : {}),
    ...(query.includeInactive ? {} : { isActive: true }),
    ...(query.search
      ? {
          AND: [
            {
              OR: [
                { nameEn: { contains: query.search, mode: "insensitive" as const } },
                { nameBn: { contains: query.search } },
                { aliases: { has: query.search } },
              ],
            },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.groceryItem.count({ where }),
    db.groceryItem.findMany({
      where,
      orderBy: [{ isCustom: "desc" }, { category: "asc" }, { nameEn: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  const itemIds = items.map((item) => item.id);
  const [prices, masterPrices] = await Promise.all([
    latestPricesFor(
      messId,
      itemIds,
    ),
    masterPricesFor(itemIds),
  ]);

  return {
    items: items.map((item) => toDto(item, prices.get(item.id), masterPrices.get(item.id))),
    meta: paginationMeta(pagination, total),
  };
}

export async function getCatalogueItem(messId: string, itemId: string): Promise<GroceryItemDto> {
  const item = await db.groceryItem.findFirst({ where: { id: itemId, OR: [{ messId: null }, { messId }] } });
  if (!item) throw AppError.notFound("Grocery item not found");
  const [prices, masterPrices] = await Promise.all([
    latestPricesFor(messId, [item.id]),
    masterPricesFor([item.id]),
  ]);
  return toDto(item, prices.get(item.id), masterPrices.get(item.id));
}

export async function createCustomItem(
  messId: string,
  actorUserId: string,
  input: CreateGroceryItemInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<GroceryItemDto> {
  const duplicate = await db.groceryItem.findFirst({
    where: { OR: [{ messId: null }, { messId }], nameEn: { equals: input.nameEn, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw AppError.conflict("A grocery item with this English name already exists");

  const item = await db.$transaction(async (tx) => {
    const createdItem = await tx.groceryItem.create({
      data: {
        messId,
        nameEn: input.nameEn,
        nameBn: input.nameBn,
        aliases: input.aliases,
        category: input.category,
        unit: input.unit,
        brand: input.brand ?? null,
        isCustom: true,
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryItem",
      entityId: createdItem.id,
      action: "CREATE",
      after: { nameEn: createdItem.nameEn, nameBn: createdItem.nameBn, unit: createdItem.unit },
      ...ctx,
    });

    return createdItem;
  });

  return toDto(item);
}

export async function updateCustomItem(
  messId: string,
  itemId: string,
  actorUserId: string,
  input: UpdateGroceryItemInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<GroceryItemDto> {
  const before = await db.groceryItem.findFirst({ where: { id: itemId, messId } });
  if (!before) {
    const global = await db.groceryItem.findFirst({ where: { id: itemId, messId: null }, select: { id: true } });
    if (global) throw AppError.forbidden("Shared catalogue items cannot be edited");
    throw AppError.notFound("Grocery item not found");
  }

  const item = await db.$transaction(async (tx) => {
    const updated = await tx.groceryItem.update({
      where: { id: itemId },
      data: {
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.nameBn !== undefined ? { nameBn: input.nameBn } : {}),
        ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryItem",
      entityId: itemId,
      action: "UPDATE",
      before: { nameEn: before.nameEn, unit: before.unit, isActive: before.isActive },
      after: { nameEn: updated.nameEn, unit: updated.unit, isActive: updated.isActive },
      ...ctx,
    });

    return updated;
  });

  return toDto(item);
}

/**
 * Removes a custom item that has never been purchased. Items referenced by
 * purchase history are deactivated instead of deleted so history stays intact.
 */
export async function deleteCustomItem(
  messId: string,
  itemId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string; deleted: boolean; deactivated: boolean }> {
  const item = await db.groceryItem.findFirst({ where: { id: itemId, messId } });
  if (!item) throw AppError.notFound("Custom grocery item not found");

  const used = await db.bazarEntryItem.count({ where: { groceryItemId: itemId } });

  await db.$transaction(async (tx) => {
    if (used > 0) {
      await tx.groceryItem.update({ where: { id: itemId }, data: { isActive: false } });
    } else {
      await tx.groceryItem.delete({ where: { id: itemId } });
    }

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "GroceryItem",
      entityId: itemId,
      action: used > 0 ? "DEACTIVATE" : "DELETE",
      before: { nameEn: item.nameEn, isActive: item.isActive },
      reason: used > 0 ? "Item is referenced by purchase history" : undefined,
      ...ctx,
    });
  });

  return { id: itemId, deleted: used === 0, deactivated: used > 0 };
}

async function seedCatalogueOnce(): Promise<number> {
  const existing = await db.groceryItem.count({ where: { messId: null, isCustom: false } });
  if (existing >= CATALOGUE_SEED.length) return 0;

  let created = 0;
  for (const item of CATALOGUE_SEED) {
    const found = await db.groceryItem.findFirst({
      where: { messId: null, isCustom: false, nameEn: item.nameEn },
      select: { id: true },
    });
    if (found) continue;
    await db.groceryItem.create({
      data: {
        messId: null,
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        aliases: item.aliases,
        category: item.category,
        unit: item.unit,
        brand: item.brand ?? null,
        isCustom: false,
      },
    });
    created += 1;
  }
  return created;
}

/** Idempotent: seeds the shared Bangladeshi catalogue. Safe to run repeatedly. */
export async function seedGroceryCatalogue(): Promise<number> {
  return seedCatalogueOnce();
}
