import type { GroceryItem, GroceryMasterPrice } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { fromDateOnly, toDateOnly } from "../../app/utils/date.ts";
import { paginationMeta, parsePagination } from "../../app/utils/pagination.ts";
import type { AdminGroceryMasterListQuery, UpdateGroceryMasterItemInput } from "./grocery-master.schema.ts";

type MasterItemRow = GroceryItem & { masterPrice: GroceryMasterPrice | null };

function toDto(item: MasterItemRow) {
  const price = item.masterPrice;
  return {
    id: item.id,
    sourceItemId: price?.sourceItemId ?? null,
    nameEn: item.nameEn,
    nameBn: item.nameBn,
    category: item.category,
    unit: item.unit,
    isActive: item.isActive,
    masterPrice: price
      ? {
          unitLabel: price.unitLabel,
          minPricePoisha: price.minPricePoisha.toString(),
          maxPricePoisha: price.maxPricePoisha.toString(),
          referencePricePoisha: price.referencePricePoisha.toString(),
          sourceNote: price.sourceNote,
          sourceUrl: price.sourceUrl,
          checkedOn: fromDateOnly(price.checkedOn),
          priceType: price.priceType,
          isActive: price.isActive,
          notes: price.notes,
        }
      : null,
  };
}

const includeMasterPrice = { masterPrice: true } as const;

export async function listAdminGroceryMaster(query: AdminGroceryMasterListQuery) {
  const pagination = parsePagination(query);
  const where = {
    messId: null,
    isCustom: false,
    ...(query.q
      ? {
          OR: [
            { nameEn: { contains: query.q, mode: "insensitive" as const } },
            { nameBn: { contains: query.q } },
            { category: { contains: query.q, mode: "insensitive" as const } },
            { masterPrice: { sourceItemId: { contains: query.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.groceryItem.count({ where }),
    db.groceryItem.findMany({
      where,
      include: includeMasterPrice,
      orderBy: [{ category: "asc" }, { nameEn: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return { items: items.map((item) => toDto(item)), meta: paginationMeta(pagination, total) };
}

export async function updateAdminGroceryMasterItem(
  itemId: string,
  actorUserId: string,
  input: UpdateGroceryMasterItemInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
) {
  const before = await db.groceryItem.findFirst({
    where: { id: itemId, messId: null, isCustom: false },
    include: includeMasterPrice,
  });
  if (!before) throw AppError.notFound("Shared grocery item not found");

  const oldPrice = before.masterPrice;
  const priceFields = [
    input.unitLabel,
    input.minPriceTaka,
    input.maxPriceTaka,
    input.referencePriceTaka,
    input.sourceNote,
    input.sourceUrl,
    input.checkedOn,
    input.priceType,
    input.priceIsActive,
    input.notes,
  ];
  const changesPrice = priceFields.some((value) => value !== undefined);
  if (changesPrice && !oldPrice) {
    throw AppError.business("This shared item has no master price record to update");
  }

  const minPrice = input.minPriceTaka ?? oldPrice?.minPricePoisha;
  const maxPrice = input.maxPriceTaka ?? oldPrice?.maxPricePoisha;
  const referencePrice = input.referencePriceTaka ?? oldPrice?.referencePricePoisha;
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    referencePrice !== undefined &&
    (minPrice < 0n || minPrice > referencePrice || referencePrice > maxPrice)
  ) {
    throw AppError.badRequest("Price range must satisfy minimum ≤ reference price ≤ maximum");
  }

  const updated = await db.$transaction(async (tx) => {
    const groceryItem = await tx.groceryItem.update({
      where: { id: itemId },
      data: {
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.nameBn !== undefined ? { nameBn: input.nameBn } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (changesPrice && oldPrice) {
      await tx.groceryMasterPrice.update({
        where: { groceryItemId: itemId },
        data: {
          ...(input.unitLabel !== undefined ? { unitLabel: input.unitLabel } : {}),
          ...(input.minPriceTaka !== undefined ? { minPricePoisha: input.minPriceTaka } : {}),
          ...(input.maxPriceTaka !== undefined ? { maxPricePoisha: input.maxPriceTaka } : {}),
          ...(input.referencePriceTaka !== undefined ? { referencePricePoisha: input.referencePriceTaka } : {}),
          ...(input.sourceNote !== undefined ? { sourceNote: input.sourceNote } : {}),
          ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
          ...(input.checkedOn !== undefined ? { checkedOn: toDateOnly(input.checkedOn) } : {}),
          ...(input.priceType !== undefined ? { priceType: input.priceType } : {}),
          ...(input.priceIsActive !== undefined ? { isActive: input.priceIsActive } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
    }

    await writeAuditLog(tx, {
      actorUserId,
      entityType: changesPrice ? "GroceryMasterPrice" : "GroceryItem",
      entityId: oldPrice?.id ?? itemId,
      action: "UPDATE",
      before: {
        nameEn: before.nameEn,
        nameBn: before.nameBn,
        category: before.category,
        referencePricePoisha: oldPrice?.referencePricePoisha.toString() ?? null,
        isActive: oldPrice?.isActive ?? before.isActive,
      },
      after: {
        nameEn: groceryItem.nameEn,
        nameBn: groceryItem.nameBn,
        category: groceryItem.category,
        referencePricePoisha: input.referencePriceTaka?.toString() ?? oldPrice?.referencePricePoisha.toString() ?? null,
        isActive: input.priceIsActive ?? oldPrice?.isActive ?? groceryItem.isActive,
      },
      ...ctx,
    });

    return tx.groceryItem.findUniqueOrThrow({ where: { id: itemId }, include: includeMasterPrice });
  });

  return toDto(updated);
}

export async function deleteAdminGroceryMasterPrice(
  itemId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const price = await db.groceryMasterPrice.findFirst({
    where: { groceryItemId: itemId, groceryItem: { messId: null, isCustom: false } },
  });
  if (!price) throw AppError.notFound("Shared grocery master price not found");

  await db.$transaction(async (tx) => {
    await tx.groceryMasterPrice.delete({ where: { id: price.id } });
    await writeAuditLog(tx, {
      actorUserId,
      entityType: "GroceryMasterPrice",
      entityId: price.id,
      action: "DELETE",
      before: {
        sourceItemId: price.sourceItemId,
        referencePricePoisha: price.referencePricePoisha.toString(),
        sourceUrl: price.sourceUrl,
      },
      ...ctx,
    });
  });

  return { id: price.id };
}

export async function deleteAdminGroceryMasterItem(
  itemId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string; deleted: boolean; deactivated: boolean }> {
  const item = await db.groceryItem.findFirst({
    where: { id: itemId, messId: null, isCustom: false },
    include: includeMasterPrice,
  });
  if (!item) throw AppError.notFound("Shared grocery item not found");

  const used = await db.bazarEntryItem.count({ where: { groceryItemId: itemId } });
  await db.$transaction(async (tx) => {
    if (used > 0) {
      await tx.groceryItem.update({ where: { id: itemId }, data: { isActive: false } });
      if (item.masterPrice) {
        await tx.groceryMasterPrice.update({
          where: { id: item.masterPrice.id },
          data: { isActive: false },
        });
      }
    } else {
      await tx.groceryItem.delete({ where: { id: itemId } });
    }
    await writeAuditLog(tx, {
      actorUserId,
      entityType: "GroceryItem",
      entityId: itemId,
      action: used > 0 ? "DEACTIVATE" : "DELETE",
      before: { nameEn: item.nameEn, isActive: item.isActive },
      reason: used > 0 ? "Item is referenced by bazar history; item and master price deactivated" : undefined,
      ...ctx,
    });
  });

  return { id: itemId, deleted: used === 0, deactivated: used > 0 };
}
