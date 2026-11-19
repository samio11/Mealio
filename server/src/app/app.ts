import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmetPackage from "helmet";
import { pinoHttp } from "pino-http";
import type { HelmetOptions } from "helmet";

import { auth } from "../modules/auth/auth.ts";
import { aiRouter } from "../modules/ai/ai.routes.ts";
import { adminRouter } from "../modules/admin/admin.routes.ts";
import { auditLogsRouter } from "../modules/audit-logs/audit-logs.routes.ts";
import { bazarRouter } from "../modules/bazar/bazar.routes.ts";
import { dutiesRouter } from "../modules/bazar-duty/bazar-duty.routes.ts";
import { depositsRouter } from "../modules/deposits/deposits.routes.ts";
import { expensesRouter } from "../modules/expenses/expenses.routes.ts";
import { groceryCatalogueRouter } from "../modules/grocery-catalogue/grocery-catalogue.routes.ts";
import { groceryPricesRouter } from "../modules/grocery-prices/grocery-prices.routes.ts";
import { invitationsRouter, messInvitationsRouter } from "../modules/invitations/invitations.routes.ts";
import { mediaRouter } from "../modules/media/media.routes.ts";
import { mealsRouter, menusRouter } from "../modules/meals/meals.routes.ts";
import { membershipsRouter } from "../modules/memberships/memberships.routes.ts";
import { messesRouter } from "../modules/messes/messes.routes.ts";
import { monthsRouter } from "../modules/months/months.routes.ts";
import { reportsRouter } from "../modules/reports/reports.routes.ts";
import { usersRouter } from "../modules/users/users.routes.ts";
import { utilitiesRouter } from "../modules/utilities/utilities.routes.ts";
import { env, isTest } from "./config/env.ts";
import { errorHandler } from "./middlewares/error.ts";
import { notFoundHandler } from "./middlewares/not-found.ts";
import { ok } from "./utils/api-response.ts";
import { logger } from "./utils/logger.ts";

// Vercel's Node TypeScript checker treats Helmet's default export as a module namespace.
const helmet = helmetPackage as unknown as (
  options?: Readonly<HelmetOptions>,
) => RequestHandler;

/**
 * Builds the Express application.
 *
 * Middleware order matters:
 *   1. security + CORS + logging
 *   2. Better-Auth handler (needs the RAW request stream, so it must be mounted
 *      before any body parser)
 *   3. body parsers
 *   4. rate limiting
 *   5. feature routers
 *   6. not-found + central error handler (always last)
 */
export function createApp(app: Express = express()): Express {
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // This is a JSON API; the browser CSP is enforced by the client.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: [env.FRONTEND_URL, env.BETTER_AUTH_URL],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.use(pinoHttp({ logger }));

  // Better-Auth owns /api/auth/*. Mounted before express.json() so the session
  // handler can read the raw stream itself.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!isTest) {
    app.use(
      "/api",
      rateLimit({
        windowMs: 60_000,
        limit: 300,
        standardHeaders: "draft-8",
        legacyHeaders: false,
      }),
    );
  }

  app.get("/", (_req, res) => {
    ok(res, { service: "Mealio API", status: "ok", health: "/health" });
  });

  // Liveness probe — intentionally outside the /api rate limit.
  app.get("/health", (_req, res) => {
    ok(res, { status: "ok", env: env.NODE_ENV, uptime: Math.round(process.uptime()) });
  });

  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/admin", adminRouter);
  // More specific mess sub-resources are mounted before the generic mess router.
  app.use("/api/v1/messes/:messId/members", membershipsRouter);
  app.use("/api/v1/messes/:messId/invitations", messInvitationsRouter);
  app.use("/api/v1/messes/:messId/months", monthsRouter);
  app.use("/api/v1/messes/:messId/meals", mealsRouter);
  app.use("/api/v1/messes/:messId/menus", menusRouter);
  app.use("/api/v1/messes/:messId/grocery-items", groceryCatalogueRouter);
  app.use("/api/v1/messes/:messId/grocery-prices", groceryPricesRouter);
  app.use("/api/v1/messes/:messId/deposits", depositsRouter);
  app.use("/api/v1/messes/:messId/expenses", expensesRouter);
  app.use("/api/v1/messes/:messId/utilities", utilitiesRouter);
  app.use("/api/v1/messes/:messId/bazar-entries", bazarRouter);
  app.use("/api/v1/messes/:messId/duties", dutiesRouter);
  app.use("/api/v1/messes/:messId/reports", reportsRouter);
  app.use("/api/v1/messes/:messId/media", mediaRouter);
  app.use("/api/v1/messes/:messId/ai", aiRouter);
  app.use("/api/v1/messes/:messId/audit-logs", auditLogsRouter);
  app.use("/api/v1/messes", messesRouter);
  app.use("/api/v1/invitations", invitationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
