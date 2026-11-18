import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { created, ok, paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import {
  createGroceryItemSchema,
  groceryItemIdParamSchema,
  listCatalogueQuerySchema,
  updateGroceryItemSchema,
} from "./grocery-catalogue.schema.ts";
import {
  createCustomItem,
  deleteCustomItem,
  getCatalogueItem,
  listCatalogue,
  updateCustomItem,
} from "./grocery-catalogue.service.ts";
import { z } from "zod";
import { zUuid } from "../../app/utils/zod-helpers.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/grocery-items`. */
export const groceryCatalogueRouter: Router = Router({ mergeParams: true });

groceryCatalogueRouter.use(requireAuth);

groceryCatalogueRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listCatalogueQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listCatalogue(req.auth!.messId!, req.listQuery as never);
    return paginated(res, items, meta);
  }),
);

groceryCatalogueRouter.get(
  "/:itemId",
  validate({ params: groceryItemIdParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(res, await getCatalogueItem(req.auth!.messId!, req.params.itemId as string)),
  ),
);

groceryCatalogueRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createGroceryItemSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await createCustomItem(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);

groceryCatalogueRouter.patch(
  "/:itemId",
  validate({ params: groceryItemIdParamSchema, body: updateGroceryItemSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateCustomItem(
        req.auth!.messId!,
        req.params.itemId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

groceryCatalogueRouter.delete(
  "/:itemId",
  validate({ params: groceryItemIdParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteCustomItem(
        req.auth!.messId!,
        req.params.itemId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);
