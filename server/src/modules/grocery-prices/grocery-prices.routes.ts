import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok, paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  createPriceSchema,
  listPricesQuerySchema,
  priceIdParamSchema,
  updatePriceSchema,
} from "./grocery-prices.schema.ts";
import {
  createPrice,
  deletePrice,
  listLatestPrices,
  listPrices,
  updatePriceVerification,
} from "./grocery-prices.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });
const latestQuerySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/grocery-prices`. */
export const groceryPricesRouter: Router = Router({ mergeParams: true });

groceryPricesRouter.use(requireAuth);

groceryPricesRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listPricesQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listPrices(req.auth!.messId!, req.listQuery as never);
    return paginated(res, items, meta);
  }),
);

groceryPricesRouter.get(
  "/latest",
  validate({ params: latestQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await listLatestPrices(req.auth!.messId!))),
);

groceryPricesRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createPriceSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    created(res, await createPrice(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

groceryPricesRouter.patch(
  "/:priceId",
  validate({ params: priceIdParamSchema, body: updatePriceSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updatePriceVerification(
        req.auth!.messId!,
        req.params.priceId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

groceryPricesRouter.delete(
  "/:priceId",
  validate({ params: priceIdParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deletePrice(req.auth!.messId!, req.params.priceId as string, req.auth!.user.id, requestContext(req)),
    ),
  ),
);
