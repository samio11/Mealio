import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  createMonthSchema,
  listMonthsQuerySchema,
  mealSettingParamSchema,
  monthParamSchema,
  updateMealSettingSchema,
  updateMonthSchema,
} from "./months.schema.ts";
import {
  createMonth,
  getMonthDetail,
  listMonths,
  setMonthStatus,
  updateMealSetting,
  updateMonth,
} from "./months.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/months`. */
export const monthsRouter: Router = Router({ mergeParams: true });

monthsRouter.use(requireAuth);

monthsRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listMonthsQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await listMonths(req.auth!.messId!, req.listQuery as never)),
  ),
);

monthsRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createMonthSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    created(res, await createMonth(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

monthsRouter.get(
  "/:monthId",
  validate({ params: monthParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getMonthDetail(req.auth!.messId!, req.params.monthId as string)),
  ),
);

monthsRouter.patch(
  "/:monthId",
  validate({ params: monthParamSchema, body: updateMonthSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateMonth(req.auth!.messId!, req.params.monthId as string, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);

monthsRouter.patch(
  "/:monthId/meal-settings/:mealType",
  validate({ params: mealSettingParamSchema, body: updateMealSettingSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateMealSetting(
        req.auth!.messId!,
        req.params.monthId as string,
        req.params.mealType as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

monthsRouter.post(
  "/:monthId/close",
  validate({ params: monthParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await setMonthStatus(req.auth!.messId!, req.params.monthId as string, req.auth!.user.id, "CLOSED", requestContext(req)),
    ),
  ),
);

monthsRouter.post(
  "/:monthId/reopen",
  validate({ params: monthParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await setMonthStatus(req.auth!.messId!, req.params.monthId as string, req.auth!.user.id, "OPEN", requestContext(req)),
    ),
  ),
);
