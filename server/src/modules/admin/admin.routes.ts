import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requirePlatformAdmin } from "../../app/middlewares/platform-admin.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { ok, paginated } from "../../app/utils/api-response.ts";
import { requestContext } from "../../app/utils/audit.ts";
import {
  adminListQuerySchema,
  adminMessParamSchema,
  adminUserParamSchema,
  deleteAdminUserSchema,
  deleteMessSchema,
  setAdminUserBlockedSchema,
  updatePlatformRoleSchema,
  type AdminListQuery,
} from "./admin.schema.ts";
import {
  deleteAdminMess,
  deleteAdminUser,
  getAdminMess,
  getAdminOverview,
  getAdminUser,
  listAdminMesses,
  listAdminUsers,
  setAdminUserBlocked,
  updatePlatformRole,
} from "./admin.service.ts";
import {
  adminGroceryMasterItemParamSchema,
  adminGroceryMasterListQuerySchema,
  updateGroceryMasterItemSchema,
} from "./grocery-master.schema.ts";
import {
  deleteAdminGroceryMasterItem,
  deleteAdminGroceryMasterPrice,
  listAdminGroceryMaster,
  updateAdminGroceryMasterItem,
} from "./grocery-master.service.ts";

export const adminRouter: Router = Router();

adminRouter.use(requireAuth, requirePlatformAdmin);

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => ok(res, await getAdminOverview())),
);

adminRouter.get(
  "/users",
  validate({ query: adminListQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listAdminUsers(req.listQuery as AdminListQuery);
    return paginated(res, result.items, result.meta);
  }),
);

adminRouter.get(
  "/users/:userId",
  validate({ params: adminUserParamSchema }),
  asyncHandler(async (req, res) => ok(res, await getAdminUser(req.params.userId as string))),
);

adminRouter.patch(
  "/users/:userId/role",
  validate({ params: adminUserParamSchema, body: updatePlatformRoleSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updatePlatformRole(req.auth!.user.id, req.params.userId as string, req.body.platformRole),
    ),
  ),
);

adminRouter.patch(
  "/users/:userId/block",
  validate({ params: adminUserParamSchema, body: setAdminUserBlockedSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await setAdminUserBlocked(req.auth!.user.id, req.params.userId as string, req.body.blocked),
    ),
  ),
);

adminRouter.delete(
  "/users/:userId",
  validate({ params: adminUserParamSchema, body: deleteAdminUserSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteAdminUser(
        req.auth!.user.id,
        req.params.userId as string,
        req.body.confirmationEmail,
      ),
    ),
  ),
);

adminRouter.get(
  "/messes",
  validate({ query: adminListQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listAdminMesses(req.listQuery as AdminListQuery);
    return paginated(res, result.items, result.meta);
  }),
);

adminRouter.get(
  "/messes/:messId",
  validate({ params: adminMessParamSchema }),
  asyncHandler(async (req, res) => ok(res, await getAdminMess(req.params.messId as string))),
);

adminRouter.delete(
  "/messes/:messId",
  validate({ params: adminMessParamSchema, body: deleteMessSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteAdminMess(req.params.messId as string, req.body.confirmationName),
    ),
  ),
);

adminRouter.get(
  "/grocery-master",
  validate({ query: adminGroceryMasterListQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listAdminGroceryMaster(req.listQuery as never);
    return paginated(res, result.items, result.meta);
  }),
);

adminRouter.patch(
  "/grocery-master/:itemId",
  validate({ params: adminGroceryMasterItemParamSchema, body: updateGroceryMasterItemSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await updateAdminGroceryMasterItem(
        req.params.itemId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

adminRouter.delete(
  "/grocery-master/:itemId/price",
  validate({ params: adminGroceryMasterItemParamSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteAdminGroceryMasterPrice(
        req.params.itemId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);

adminRouter.delete(
  "/grocery-master/:itemId",
  validate({ params: adminGroceryMasterItemParamSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteAdminGroceryMasterItem(
        req.params.itemId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);
