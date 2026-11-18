import { Router } from "express";

import { requireAuth } from "../../app/middlewares/auth.ts";
import { requireMessAccess } from "../../app/middlewares/tenant.ts";
import { validate } from "../../app/middlewares/validate.ts";
import { ok } from "../../app/utils/api-response.ts";
import { asyncHandler } from "../../app/utils/async-handler.ts";
import { messIdParamOnlySchema, monthReportQuerySchema } from "./reports.schema.ts";
import {
  getMemberBalances,
  getMonthSummary,
  getMonthlyReport,
  monthlyReportToCsv,
} from "./reports.service.ts";

/** Mounted at `/api/v1/messes/:messId/reports`. */
export const reportsRouter: Router = Router({ mergeParams: true });

reportsRouter.use(requireAuth);

reportsRouter.get(
  "/monthly",
  validate({ params: messIdParamOnlySchema, query: monthReportQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await getMonthlyReport(req.auth!.messId!, req.listQuery as never))),
);

reportsRouter.get(
  "/summary",
  validate({ params: messIdParamOnlySchema, query: monthReportQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await getMonthSummary(req.auth!.messId!, req.listQuery as never))),
);

reportsRouter.get(
  "/balances",
  validate({ params: messIdParamOnlySchema, query: monthReportQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => ok(res, await getMemberBalances(req.auth!.messId!, req.listQuery as never))),
);

/** CSV export of the monthly report (downloadable attachment). */
reportsRouter.get(
  "/monthly.csv",
  validate({ params: messIdParamOnlySchema, query: monthReportQuerySchema }),
  requireMessAccess(),
  asyncHandler(async (req, res) => {
    const report = await getMonthlyReport(req.auth!.messId!, req.listQuery as never);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mess-report-${report.month.label}.csv"`);
    return res.status(200).send(monthlyReportToCsv(report));
  }),
);
