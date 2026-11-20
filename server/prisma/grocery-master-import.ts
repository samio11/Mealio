import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { db } from "../src/app/db/prisma.ts";
import { takaToPoisha } from "../src/app/utils/money.ts";

interface CsvRow {
  item_id: string;
  category_en: string;
  category_bn: string;
  product_name_en: string;
  product_name_bn: string;
  unit: string;
  price_min_bdt: string;
  price_max_bdt: string;
  reference_price_bdt: string;
  price_source_note: string;
  source_url: string;
  price_checked_date: string;
  price_type: string;
  is_active: string;
  notes: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseRows(text: string): CsvRow[] {
  const [header, ...values] = parseCsv(text);
  if (!header) throw new Error("CSV is empty");
  const indices = new Map(header.map((name, index) => [name.trim(), index]));
  const required: (keyof CsvRow)[] = [
    "item_id",
    "category_en",
    "category_bn",
    "product_name_en",
    "product_name_bn",
    "unit",
    "price_min_bdt",
    "price_max_bdt",
    "reference_price_bdt",
    "price_source_note",
    "source_url",
    "price_checked_date",
    "price_type",
    "is_active",
    "notes",
  ];
  for (const name of required) {
    if (!indices.has(name)) throw new Error(`CSV is missing the required column "${name}"`);
  }

  return values.map((valuesInRow, rowIndex) => {
    const row = Object.fromEntries(
      required.map((name) => [name, valuesInRow[indices.get(name)!]?.trim() ?? ""]),
    ) as CsvRow;
    if (!row.item_id || !row.product_name_en || !row.product_name_bn) {
      throw new Error(`CSV row ${rowIndex + 2} is missing an item ID or bilingual name`);
    }
    const min = Number(row.price_min_bdt);
    const max = Number(row.price_max_bdt);
    const reference = Number(row.reference_price_bdt);
    if (![min, max, reference].every(Number.isFinite) || min < 0 || min > reference || reference > max) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid price range`);
    }
    if (!/^https?:\/\//i.test(row.source_url)) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid source URL`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.price_checked_date)) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid checked date`);
    }
    return row;
  });
}

function operationalUnit(sourceUnit: string): "KG" | "GRAM" | "LITRE" | "ML" | "PIECE" | "DOZEN" | "PACKET" | "BOTTLE" {
  if (sourceUnit === "KG" || sourceUnit === "GRAM" || sourceUnit === "LITRE" || sourceUnit === "ML" || sourceUnit === "DOZEN") {
    return sourceUnit;
  }
  if (sourceUnit.startsWith("BOTTLE")) return "BOTTLE";
  if (sourceUnit.startsWith("PACKET") || sourceUnit.startsWith("JAR")) return "PACKET";
  return "PIECE";
}

export async function readGroceryMasterList(filePath?: string): Promise<CsvRow[]> {
  const csvPath = filePath ?? fileURLToPath(new URL("../../bangladesh_grocery_master_list_2026-11-20.csv", import.meta.url));
  const rows = parseRows(await readFile(csvPath, "utf8"));
  const seenIds = new Set<string>();
  for (const row of rows) {
    if (seenIds.has(row.item_id)) throw new Error(`Duplicate CSV item ID: ${row.item_id}`);
    seenIds.add(row.item_id);
  }
  return rows;
}

export async function importGroceryMasterList(filePath?: string, replaceExisting = false): Promise<number> {
  const rows = await readGroceryMasterList(filePath);
  let imported = 0;

  for (const row of rows) {
    const didImport = await db.$transaction(async (tx) => {
      const previousPrice = await tx.groceryMasterPrice.findUnique({
        where: { sourceItemId: row.item_id },
      });
      if (previousPrice && !replaceExisting) return false;

      const existing = previousPrice
        ? await tx.groceryItem.findUnique({ where: { id: previousPrice.groceryItemId } })
        : await tx.groceryItem.findFirst({
            where: {
              messId: null,
              isCustom: false,
              nameEn: { equals: row.product_name_en, mode: "insensitive" },
            },
          });
      const groceryItem = existing
        ? await tx.groceryItem.update({
            where: { id: existing.id },
            data: {
              nameEn: row.product_name_en,
              nameBn: row.product_name_bn,
              category: row.category_en,
              unit: operationalUnit(row.unit),
              isActive: row.is_active.toLowerCase() === "true",
            },
          })
        : await tx.groceryItem.create({
            data: {
              messId: null,
              nameEn: row.product_name_en,
              nameBn: row.product_name_bn,
              aliases: [],
              category: row.category_en,
              unit: operationalUnit(row.unit),
              isCustom: false,
              isActive: row.is_active.toLowerCase() === "true",
            },
          });

      await tx.groceryMasterPrice.upsert({
        where: { sourceItemId: row.item_id },
        create: {
          sourceItemId: row.item_id,
          groceryItemId: groceryItem.id,
          unitLabel: row.unit,
          minPricePoisha: takaToPoisha(row.price_min_bdt),
          maxPricePoisha: takaToPoisha(row.price_max_bdt),
          referencePricePoisha: takaToPoisha(row.reference_price_bdt),
          sourceNote: row.price_source_note,
          sourceUrl: row.source_url,
          checkedOn: new Date(`${row.price_checked_date}T00:00:00.000Z`),
          priceType: row.price_type,
          isActive: row.is_active.toLowerCase() === "true",
          notes: row.notes,
        },
        update: {
          groceryItemId: groceryItem.id,
          unitLabel: row.unit,
          minPricePoisha: takaToPoisha(row.price_min_bdt),
          maxPricePoisha: takaToPoisha(row.price_max_bdt),
          referencePricePoisha: takaToPoisha(row.reference_price_bdt),
          sourceNote: row.price_source_note,
          sourceUrl: row.source_url,
          checkedOn: new Date(`${row.price_checked_date}T00:00:00.000Z`),
          priceType: row.price_type,
          isActive: row.is_active.toLowerCase() === "true",
          notes: row.notes,
        },
      });
      return true;
    });
    if (didImport) imported += 1;
  }

  return imported;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const validateOnly = args[0] === "--validate-only";
  const replaceExisting = args.includes("--replace");
  const filePath = args.find((arg) => arg !== "--validate-only" && arg !== "--replace");
  (validateOnly
    ? readGroceryMasterList(filePath).then((rows) => rows.length)
    : importGroceryMasterList(filePath, replaceExisting))
    .then((count) => {
      console.info(
        validateOnly
          ? `Validated ${count} grocery master rows.`
          : `Imported or refreshed ${count} grocery master rows.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Grocery master import failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
