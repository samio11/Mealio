import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { ok, paginated } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { requestContext } from "../../app/utils/audit.ts";
import { zUuid } from "../../app/utils/zod-helpers.ts";
import {
  listUtilitiesQuerySchema,
  rejectUtilityPaymentSchema,
  setUtilityBillPaidSchema,
  submitUtilityPaymentSchema,
  utilityExpenseParamSchema,
  utilityPaymentParamSchema,
} from "./utilities.schema.ts";
import {
  listUtilities,
  deleteUtilityBill,
  rejectUtilityPayment,
  setUtilityBillPaid,
  submitUtilityPayment,
  verifyUtilityPayment,
} from "./utilities.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/utilities`. */
export const utilitiesRouter: Router = Router({ mergeParams: true });

utilitiesRouter.use(requireAuth);

utilitiesRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listUtilitiesQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listUtilities(
      req.auth!.messId!,
      req.auth!.membership!.id,
      req.auth!.membership!.role === "MANAGER",
      req.listQuery as never,
    );
    return paginated(res, items, meta);
  }),
);

utilitiesRouter.post(
  "/:expenseId/payments",
  validate({ params: utilityExpenseParamSchema, body: submitUtilityPaymentSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await submitUtilityPayment(
        req.auth!.messId!,
        req.params.expenseId as string,
        req.auth!.membership!.id,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

utilitiesRouter.patch(
  "/:expenseId/payment-status",
  validate({ params: utilityExpenseParamSchema, body: setUtilityBillPaidSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await setUtilityBillPaid(
        req.auth!.messId!,
        req.params.expenseId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);

utilitiesRouter.delete(
  "/:expenseId",
  validate({ params: utilityExpenseParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await deleteUtilityBill(
        req.auth!.messId!,
        req.params.expenseId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);

utilitiesRouter.post(
  "/payments/:paymentId/verify",
  validate({ params: utilityPaymentParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await verifyUtilityPayment(
        req.auth!.messId!,
        req.params.paymentId as string,
        req.auth!.user.id,
        requestContext(req),
      ),
    ),
  ),
);

utilitiesRouter.post(
  "/payments/:paymentId/reject",
  validate({ params: utilityPaymentParamSchema, body: rejectUtilityPaymentSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rejectUtilityPayment(
        req.auth!.messId!,
        req.params.paymentId as string,
        req.auth!.user.id,
        req.body,
        requestContext(req),
      ),
    ),
  ),
);
