import { db } from "../app/db/prisma.ts";
import { AI_CONFIDENCE_THRESHOLD } from "../app/config/constants.ts";
import { AppError } from "../app/utils/app-error.ts";
import { toDhakaParts } from "../app/utils/date.ts";
import { logger } from "../app/utils/logger.ts";
import { getMonthSummary } from "../modules/reports/reports.service.ts";
import { getSignedUrl } from "../modules/media/media.service.ts";
import { matchCatalogueItem, type MatchableItem } from "./catalogue-matcher.ts";
import { isAiConfigured, parseJsonLoose, requestJson, type ChatMessage } from "./providers.ts";
import {
  BAZAR_EXTRACTION_SYSTEM_PROMPT,
  PRICE_ESTIMATE_SYSTEM_PROMPT,
  REPORT_SUMMARY_SYSTEM_PROMPT,
  bazarExtractionUserPrompt,
  priceEstimateUserPrompt,
  reportSummaryUserPrompt,
} from "./prompts.ts";
import {
  aiBazarExtractionSchema,
  aiPriceEstimateSchema,
  aiReportSummarySchema,
  type AiBazarExtraction,
  type AiPriceEstimate,
  type AiReportSummary,
} from "./schemas.ts";

export type AiStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

/**
 * Result of an AI call. `manualFallbackRequired` is true whenever the caller
 * must collect the data by hand — the AI is never allowed to block a workflow.
 */
export interface AiDraftResult<T> {
  status: AiStatus;
  provider: string | null;
  model: string | null;
  extractionId: string | null;
  data: T | null;
  errorMessage: string | null;
  manualFallbackRequired: boolean;
}

/** An extracted bazar line after catalogue matching and confidence gating. */
export interface BazarDraftItem {
  name: string;
  nameBn: string | null;
  quantity: number;
  unit: string;
  unitPriceTaka: number | null;
  confidence: number;
  /** True when confidence is below the product threshold → must be entered manually. */
  needsReview: boolean;
  matchedGroceryItemId: string | null;
  matchScore: number | null;
  matchedOn: string | null;
  notes: string | null;
}

export interface BazarDraft extends Omit<AiBazarExtraction, "items"> {
  items: BazarDraftItem[];
  /** The draft is never posted automatically; the user must review and submit. */
  isDraftOnly: true;
}

interface ExtractionContext {
  actorUserId: string;
  messId: string;
  bazarEntryId?: string | null;
}

function emptyResult<T>(status: AiStatus, errorMessage: string | null): AiDraftResult<T> {
  return {
    status,
    provider: null,
    model: null,
    extractionId: null,
    data: null,
    errorMessage,
    manualFallbackRequired: true,
  };
}

async function logExtraction(input: {
  messId: string;
  actorUserId: string;
  bazarEntryId?: string | null;
  provider: string;
  model: string;
  taskType: string;
  status: "SUCCEEDED" | "FAILED";
  parsed?: unknown;
  confidence?: number | null;
  errorMessage?: string | null;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
}): Promise<string> {
  const row = await db.aIExtraction.create({
    data: {
      messId: input.messId,
      bazarEntryId: input.bazarEntryId ?? null,
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      status: input.status,
      parsed: (input.parsed ?? null) as never,
      confidence: input.confidence ?? null,
      errorMessage: input.errorMessage ?? null,
      tokensPrompt: input.tokensPrompt ?? null,
      tokensCompletion: input.tokensCompletion ?? null,
      createdById: input.actorUserId,
    },
    select: { id: true },
  });
  return row.id;
}

async function loadCatalogue(messId: string): Promise<MatchableItem[]> {
  return db.groceryItem.findMany({
    where: { isActive: true, OR: [{ messId: null }, { messId }] },
    select: { id: true, nameEn: true, nameBn: true, aliases: true, unit: true },
  });
}

export interface ExtractBazarInput {
  imageUrls?: string[];
  mediaIds?: string[];
  messName?: string;
}

/**
 * Extracts a **draft** bazar entry from photo(s). It never creates or approves an
 * expense; the caller must review the draft and submit it through the bazar module.
 */
export async function extractBazarDraft(
  messId: string,
  input: ExtractBazarInput,
  ctx: ExtractionContext,
): Promise<AiDraftResult<BazarDraft>> {
  if (!isAiConfigured()) return emptyResult("SKIPPED", "AI is not configured; please enter the bazar items manually");

  const imageUrls: string[] = [...(input.imageUrls ?? [])];
  for (const mediaId of input.mediaIds ?? []) {
    const { url } = await getSignedUrl(messId, mediaId, 10 * 60);
    imageUrls.push(url);
  }
  if (imageUrls.length === 0) throw AppError.badRequest("Provide at least one image (mediaIds or imageUrls)");

  const parts = toDhakaParts();
  const today = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const messName =
    input.messName ?? (await db.mess.findUnique({ where: { id: messId }, select: { name: true } }))?.name;

  const messages: ChatMessage[] = [
    { role: "system", content: BAZAR_EXTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: bazarExtractionUserPrompt({ messName, today }) },
        ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ];

  try {
    const reply = await requestJson(messages, 3000);
    const parsed = aiBazarExtractionSchema.safeParse(parseJsonLoose(reply.text));

    if (!parsed.success) {
      const extractionId = await logExtraction({
        ...ctx,
        messId,
        provider: reply.provider,
        model: reply.model,
        taskType: "BAZAR_EXTRACTION",
        status: "FAILED",
        errorMessage: "Model output failed validation",
        tokensPrompt: reply.tokensPrompt,
        tokensCompletion: reply.tokensCompletion,
      });
      return {
        status: "FAILED",
        provider: reply.provider,
        model: reply.model,
        extractionId,
        data: null,
        errorMessage: "The AI reply could not be validated; please enter the items manually",
        manualFallbackRequired: true,
      };
    }

    const catalogue = await loadCatalogue(messId);
    const items: BazarDraftItem[] = parsed.data.items.map((item) => {
      const match = matchCatalogueItem(item.name, catalogue);
      return {
        name: item.name,
        nameBn: item.nameBn ?? null,
        quantity: item.quantity,
        unit: match?.item.unit ?? item.unit,
        unitPriceTaka: item.unitPriceTaka ?? null,
        confidence: item.confidence,
        needsReview: item.confidence < AI_CONFIDENCE_THRESHOLD || item.unitPriceTaka === undefined,
        matchedGroceryItemId: match?.item.id ?? null,
        matchScore: match ? Number(match.score.toFixed(3)) : null,
        matchedOn: match?.matchedOn ?? null,
        notes: item.notes ?? null,
      };
    });

    const draft: BazarDraft = { ...parsed.data, items, isDraftOnly: true };

    const extractionId = await logExtraction({
      ...ctx,
      messId,
      provider: reply.provider,
      model: reply.model,
      taskType: "BAZAR_EXTRACTION",
      status: "SUCCEEDED",
      parsed: draft,
      confidence: parsed.data.overallConfidence,
      tokensPrompt: reply.tokensPrompt,
      tokensCompletion: reply.tokensCompletion,
    });

    return {
      status: "SUCCEEDED",
      provider: reply.provider,
      model: reply.model,
      extractionId,
      data: draft,
      errorMessage: null,
      manualFallbackRequired: items.some((i) => i.needsReview),
    };
  } catch (error) {
    logger.warn({ err: error }, "bazar extraction failed");
    return emptyResult("FAILED", error instanceof AppError ? error.message : "AI extraction failed; enter items manually");
  }
}

export interface PriceEstimateInput {
  nameEn: string;
  nameBn?: string;
  unit: string;
}

/** Estimates a market price for an item. The result is a suggestion, never a verified price. */
export async function estimatePrice(
  messId: string,
  input: PriceEstimateInput,
  ctx: ExtractionContext,
): Promise<AiDraftResult<AiPriceEstimate>> {
  if (!isAiConfigured()) return emptyResult("SKIPPED", "AI is not configured; enter the price manually");

  const messages: ChatMessage[] = [
    { role: "system", content: PRICE_ESTIMATE_SYSTEM_PROMPT },
    { role: "user", content: priceEstimateUserPrompt(input) },
  ];

  try {
    const reply = await requestJson(messages, 1200);
    const parsed = aiPriceEstimateSchema.safeParse(parseJsonLoose(reply.text));

    if (!parsed.success) {
      const extractionId = await logExtraction({
        ...ctx,
        messId,
        provider: reply.provider,
        model: reply.model,
        taskType: "PRICE_ESTIMATE",
        status: "FAILED",
        errorMessage: "Model output failed validation",
        tokensPrompt: reply.tokensPrompt,
        tokensCompletion: reply.tokensCompletion,
      });
      return {
        status: "FAILED",
        provider: reply.provider,
        model: reply.model,
        extractionId,
        data: null,
        errorMessage: "The AI reply could not be validated; enter the price manually",
        manualFallbackRequired: true,
      };
    }

    const extractionId = await logExtraction({
      ...ctx,
      messId,
      provider: reply.provider,
      model: reply.model,
      taskType: "PRICE_ESTIMATE",
      status: "SUCCEEDED",
      parsed: parsed.data,
      confidence: parsed.data.confidence,
      tokensPrompt: reply.tokensPrompt,
      tokensCompletion: reply.tokensCompletion,
    });

    return {
      status: "SUCCEEDED",
      provider: reply.provider,
      model: reply.model,
      extractionId,
      data: parsed.data,
      errorMessage: null,
      manualFallbackRequired: parsed.data.confidence < AI_CONFIDENCE_THRESHOLD,
    };
  } catch (error) {
    logger.warn({ err: error }, "price estimate failed");
    return emptyResult("FAILED", error instanceof AppError ? error.message : "Price estimate failed; enter it manually");
  }
}

/** Summarises an already-computed monthly report. Read-only: it changes no data. */
export async function summarizeReport(
  messId: string,
  monthId: string,
  ctx: ExtractionContext,
): Promise<AiDraftResult<AiReportSummary>> {
  if (!isAiConfigured()) return emptyResult("SKIPPED", "AI is not configured");

  const figures = await getMonthSummary(messId, { monthId });

  const messages: ChatMessage[] = [
    { role: "system", content: REPORT_SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: reportSummaryUserPrompt(figures as unknown as Record<string, unknown>) },
  ];

  try {
    const reply = await requestJson(messages, 1500, (text) => {
      const result = aiReportSummarySchema.safeParse(parseJsonLoose(text));
      if (!result.success) {
        throw new AppError("AI provider returned an invalid report summary", 502, "AI_PROVIDER_ERROR");
      }
    });
    const parsed = aiReportSummarySchema.safeParse(parseJsonLoose(reply.text));

    if (!parsed.success) {
      const extractionId = await logExtraction({
        ...ctx,
        messId,
        provider: reply.provider,
        model: reply.model,
        taskType: "REPORT_SUMMARY",
        status: "FAILED",
        errorMessage: "Model output failed validation",
        tokensPrompt: reply.tokensPrompt,
        tokensCompletion: reply.tokensCompletion,
      });
      return {
        status: "FAILED",
        provider: reply.provider,
        model: reply.model,
        extractionId,
        data: null,
        errorMessage: "The AI reply could not be validated",
        manualFallbackRequired: false,
      };
    }

    const extractionId = await logExtraction({
      ...ctx,
      messId,
      provider: reply.provider,
      model: reply.model,
      taskType: "REPORT_SUMMARY",
      status: "SUCCEEDED",
      parsed: parsed.data,
      confidence: null,
      tokensPrompt: reply.tokensPrompt,
      tokensCompletion: reply.tokensCompletion,
    });

    return {
      status: "SUCCEEDED",
      provider: reply.provider,
      model: reply.model,
      extractionId,
      data: parsed.data,
      errorMessage: null,
      manualFallbackRequired: false,
    };
  } catch (error) {
    logger.warn({ err: error }, "report summary failed");
    return emptyResult("FAILED", error instanceof AppError ? error.message : "Report summary failed");
  }
}

export interface AiUsage {
  configured: boolean;
  todayCount: number;
  last7DaysCount: number;
  byTask: { taskType: string; count: number }[];
}

/** Lightweight usage monitor (the free OpenRouter tier allows only 50 calls/day). */
export async function getAiUsage(messId: string): Promise<AiUsage> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = (() => {
    const parts = toDhakaParts();
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  })();

  const [todayCount, rows] = await Promise.all([
    db.aIExtraction.count({ where: { messId, createdAt: { gte: startOfToday } } }),
    db.aIExtraction.findMany({
      where: { messId, createdAt: { gte: since } },
      select: { taskType: true },
    }),
  ]);

  const byTaskMap = new Map<string, number>();
  for (const row of rows) byTaskMap.set(row.taskType, (byTaskMap.get(row.taskType) ?? 0) + 1);

  return {
    configured: isAiConfigured(),
    todayCount,
    last7DaysCount: rows.length,
    byTask: [...byTaskMap.entries()].map(([taskType, count]) => ({ taskType, count })),
  };
}
