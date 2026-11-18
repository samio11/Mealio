import { z } from "zod";

import { zMonth, zUuid, zYear } from "../../app/utils/zod-helpers.ts";

export const messIdParamOnlySchema = z.object({ messId: zUuid });

/**
 * A monthly report is addressed either by an explicit `monthId` or by a
 * (year, month) pair. The service resolves whichever is supplied.
 */
export const monthReportQuerySchema = z.object({
  monthId: zUuid.optional(),
  year: zYear.optional(),
  month: zMonth.optional(),
});

export type MonthReportQuery = z.infer<typeof monthReportQuerySchema>;
