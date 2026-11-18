/**
 * Prompt builders for the AI layer.
 *
 * Every prompt explicitly states that the model must NOT approve or post any
 * financial transaction and must return `null`/omit fields it cannot see rather
 * than guessing. Output is always JSON, validated by Zod afterwards.
 */

export const BAZAR_EXTRACTION_SYSTEM_PROMPT = [
  "You are an assistant that reads Bangladeshi grocery (bazar) receipts and shopping photos.",
  "Extract ONLY what is visibly present. Never invent quantities or prices.",
  "If a field is not visible, omit it — do not guess.",
  "Prices are in Bangladeshi Taka (BDT). Quantities use metric units where possible (KG, GRAM, LITRE, ML, PIECE, DOZEN, PACKET, BOTTLE).",
  "Return JSON only, matching this shape:",
  '{"shopName"?:string,"purchaseDate"?:string(YYYY-MM-DD),"totalTaka"?:number,"overallConfidence":number(0..1),"items":[{"name":string,"nameBn"?:string,"quantity":number,"unit":string,"unitPriceTaka"?:number,"confidence":number(0..1),"notes"?:string}]}',
  "You produce a DRAFT only. You never approve, verify, or post any transaction.",
].join("\n");

export function bazarExtractionUserPrompt(context: { messName?: string; today?: string }): string {
  const lines = ["Extract the grocery items from the attached image(s)."];
  if (context.messName) lines.push(`Context: this purchase belongs to the mess "${context.messName}".`);
  if (context.today) lines.push(`Today's date is ${context.today} (Asia/Dhaka).`);
  lines.push("Give a per-line confidence between 0 and 1 reflecting how sure you are about that line.");
  return lines.join("\n");
}

export const PRICE_ESTIMATE_SYSTEM_PROMPT = [
  "You estimate a typical current retail price for a grocery item in Bangladesh (Dhaka market), in BDT.",
  "You have NO live price feed. Base the estimate on general market knowledge only and state that it is an estimate.",
  "Be conservative: set confidence low (<= 0.4) whenever you are unsure.",
  "Return JSON only, matching this shape:",
  '{"priceTaka":number,"lowTaka"?:number,"highTaka"?:number,"confidence":number(0..1),"rationale":string}',
  "You never approve, verify, or post any transaction.",
].join("\n");

export function priceEstimateUserPrompt(input: { nameEn: string; nameBn?: string; unit: string }): string {
  return [
    `Item: ${input.nameEn}${input.nameBn ? ` (${input.nameBn})` : ""}`,
    `Unit: ${input.unit}`,
    "Estimate the typical unit price in Taka for this unit.",
  ].join("\n");
}

export const REPORT_SUMMARY_SYSTEM_PROMPT = [
  "You are a careful accounting assistant for a shared-mess management system in Bangladesh.",
  "You are given already-computed monthly figures. Summarise them in plain, neutral language.",
  "Never invent numbers. Only use the figures provided.",
  "You never approve, verify, or post any transaction; you only describe the report.",
  "Return JSON only, matching this shape:",
  '{"summary":string,"highlights":string[],"concerns":string[]}',
].join("\n");

export function reportSummaryUserPrompt(figures: Record<string, unknown>): string {
  return [
    "Summarise this monthly mess report for the manager. Highlight anything unusual (e.g. low deposits vs expenses, negative closing cash, high meal rate).",
    "Figures (JSON):",
    JSON.stringify(figures, null, 2),
  ].join("\n");
}
