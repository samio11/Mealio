import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok, paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zDateOnly, zUuid } from "../../app/utils/zod-helpers.ts";
import {
  bulkMealRecordSchema,
  guestMealSchema,
  listMealRecordsQuerySchema,
  listMenusQuerySchema,
  mealRecordParamSchema,
  menuParamSchema,
  monthMealOverrideSchema,
  overrideMealRecordSchema,
  setMealRecordSchema,
  upsertMenuSchema,
} from "./meals.schema.ts";
import {
  bulkSetMealRecords,
  deleteMealRecord,
  getDayStatus,
  getMealCounts,
  getMealTimeline,
  listMealRecords,
  overrideMealMonth,
  overrideMealRecord,
  setGuestMealCount,
  setMealRecord,
} from "./meals.service.ts";
import { deleteMenu, listMenus, upsertMenu } from "./menus.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });
// messId is in the URL path (validated by messIdParamOnlySchema), not the query string.
const dayStatusQuerySchema = z.object({ date: zDateOnly.optional() });
const countsQuerySchema = z.object({ monthId: zUuid });
const timelineQuerySchema = z.object({ monthId: zUuid });

/** Mounted at `/api/v1/messes/:messId/meals`. */
export const mealsRouter: Router = Router({ mergeParams: true });

mealsRouter.use(requireAuth);

mealsRouter.get(
  "/status",
  validate({ params: messIdParamOnlySchema, query: dayStatusQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getDayStatus(req.auth!.messId!, (req.listQuery as { date?: string }).date)),
  ),
);

mealsRouter.get(
  "/counts",
  validate({ params: messIdParamOnlySchema, query: countsQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getMealCounts(req.auth!.messId!, (req.listQuery as { monthId: string }).monthId)),
  ),
);

mealsRouter.get(
  "/timeline",
  validate({ params: messIdParamOnlySchema, query: timelineQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const membership = req.auth!.membership!;
    return ok(
      res,
      await getMealTimeline(
        req.auth!.messId!,
        (req.listQuery as { monthId: string }).monthId,
        membership.role === "MANAGER" ? undefined : membership.id,
      ),
    );
  }),
);

mealsRouter.get(
  "/records",
  validate({ params: messIdParamOnlySchema, query: listMealRecordsQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const query = req.listQuery as never;
    const result = await listMealRecords(req.auth!.messId!, query);
    return paginated(res, result.items, result.meta);
  }),
);

/** A member (or a manager recording their own meal) toggles their own record. */
mealsRouter.put(
  "/records",
  validate({ params: messIdParamOnlySchema, body: setMealRecordSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await setMealRecord(
        req.auth!.messId!,
        req.auth!.membership!.id,
        req.auth!.user.id,
        req.auth!.membership!.role,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

mealsRouter.post(
  "/records/override",
  validate({ params: messIdParamOnlySchema, body: overrideMealRecordSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await overrideMealRecord(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

mealsRouter.put(
  "/records/bulk",
  validate({ params: messIdParamOnlySchema, body: bulkMealRecordSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await bulkSetMealRecords(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

mealsRouter.put(
  "/records/guests",
  validate({ params: messIdParamOnlySchema, body: guestMealSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await setGuestMealCount(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

mealsRouter.post(
  "/records/month-override",
  validate({ params: messIdParamOnlySchema, body: monthMealOverrideSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await overrideMealMonth(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

mealsRouter.delete(
  "/records/:recordId",
  validate({ params: mealRecordParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteMealRecord(req.auth!.messId!, req.params.recordId as string, req.auth!.user.id, requestContext(req)),
    ),
  ),
);

/** Mounted at `/api/v1/messes/:messId/menus`. */
export const menusRouter: Router = Router({ mergeParams: true });

menusRouter.use(requireAuth);

menusRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listMenusQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await listMenus(req.auth!.messId!, req.listQuery as never))),
);

menusRouter.put(
  "/",
  validate({ params: messIdParamOnlySchema, body: upsertMenuSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    created(res, await upsertMenu(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

menusRouter.delete(
  "/:menuId",
  validate({ params: menuParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await deleteMenu(req.auth!.messId!, req.params.menuId as string, req.auth!.user.id, requestContext(req))),
  ),
);
