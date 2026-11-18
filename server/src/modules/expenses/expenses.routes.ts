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
  createExpenseSchema,
  expenseParamSchema,
  listExpensesQuerySchema,
  rejectExpenseSchema,
  reverseExpenseSchema,
} from "./expenses.schema.ts";
import {
  approveExpense,
  createExpense,
  deletePendingExpense,
  getExpense,
  listExpenses,
  rejectExpense,
  reverseExpense,
} from "./expenses.service.ts";

const messIdParamOnlySchema = z.object({ messId: zUuid });

/** Mounted at `/api/v1/messes/:messId/expenses`. */
export const expensesRouter: Router = Router({ mergeParams: true });

expensesRouter.use(requireAuth);

expensesRouter.get(
  "/",
  validate({ params: messIdParamOnlySchema, query: listExpensesQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const { items, meta } = await listExpenses(req.auth!.messId!, req.listQuery as never);
    return paginated(res, items, meta);
  }),
);

expensesRouter.post(
  "/",
  validate({ params: messIdParamOnlySchema, body: createExpenseSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    created(res, await createExpense(req.auth!.messId!, req.auth!.user.id, req.body, requestContext(req))),
  ),
);

expensesRouter.get(
  "/:expenseId",
  validate({ params: expenseParamSchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await getExpense(req.auth!.messId!, req.params.expenseId as string))),
);

expensesRouter.post(
  "/:expenseId/approve",
  validate({ params: expenseParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await approveExpense(req.auth!.messId!, req.params.expenseId as string, req.auth!.user.id, requestContext(req))),
  ),
);

expensesRouter.post(
  "/:expenseId/reject",
  validate({ params: expenseParamSchema, body: rejectExpenseSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rejectExpense(req.auth!.messId!, req.params.expenseId as string, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);

expensesRouter.post(
  "/:expenseId/reverse",
  validate({ params: expenseParamSchema, body: reverseExpenseSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await reverseExpense(req.auth!.messId!, req.params.expenseId as string, req.auth!.user.id, req.body, requestContext(req)),
    ),
  ),
);

expensesRouter.delete(
  "/:expenseId",
  validate({ params: expenseParamSchema }),
  requireMessAccess({ manager: true }),
  asyncHandler(async (req, res) =>
    ok(res, await deletePendingExpense(req.auth!.messId!, req.params.expenseId as string, req.auth!.user.id, requestContext(req))),
  ),
);
