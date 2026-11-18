import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { db } from "../../app/db/prisma.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import { estimatePrice, extractBazarDraft, getAiUsage, summarizeReport } from "../../ai/ai.service.ts";
import { extractBazarSchema, priceEstimateSchema, reportSummarySchema } from "./ai.schema.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/ai`. */
export const aiRouter: Router = Router({ mergeParams: true });

aiRouter.use(requireAuth);

/**
 * Produces a DRAFT bazar entry from photo(s). It never creates, approves, or
 * posts a financial transaction — the member must review and submit the draft.
 */
aiRouter.post(
  "/bazar-extract",
  validate({ params: messIdParamOnlySchema, body: extractBazarSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const body = req.body as { mediaIds?: string[]; imageUrls?: string[]; bazarEntryId?: string | null };
    return ok(
      res,
      await extractBazarDraft(req.auth!.messId!, body, {
        actorUserId: req.auth!.user.id,
        messId: req.auth!.messId!,
        bazarEntryId: body.bazarEntryId ?? null,
      }),
    );
  }),
);

/** Suggests a market price (never verified, never written to the ledger automatically). */
aiRouter.post(
  "/price-estimate",
  validate({ params: messIdParamOnlySchema, body: priceEstimateSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const body = req.body as { groceryItemId?: string; nameEn?: string; nameBn?: string; unit?: string };
    let nameEn = body.nameEn;
    let nameBn = body.nameBn;
    let unit = body.unit;

    if (body.groceryItemId) {
      const item = await db.groceryItem.findFirst({
        where: { id: body.groceryItemId, OR: [{ messId: null }, { messId: req.auth!.messId! }] },
        select: { nameEn: true, nameBn: true, unit: true },
      });
      if (!item) throw AppError.notFound("Grocery item not found");
      nameEn = nameEn ?? item.nameEn;
      nameBn = nameBn ?? item.nameBn;
      unit = unit ?? item.unit;
    }

    if (!nameEn || !unit) throw AppError.badRequest("Provide either groceryItemId or (nameEn and unit)");

    return ok(
      res,
      await estimatePrice(req.auth!.messId!, { nameEn, nameBn, unit }, {
        actorUserId: req.auth!.user.id,
        messId: req.auth!.messId!,
      }),
    );
  }),
);

/** Manager-only plain-language summary of a month's computed figures. */
aiRouter.post(
  "/report-summary",
  validate({ params: messIdParamOnlySchema, body: reportSummarySchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await summarizeReport(req.auth!.messId!, (req.body as { monthId: string }).monthId, {
        actorUserId: req.auth!.user.id,
        messId: req.auth!.messId!,
      }),
    ),
  ),
);

aiRouter.get(
  "/usage",
  validate({ params: messIdParamOnlySchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) => ok(res, await getAiUsage(req.auth!.messId!))),
);
