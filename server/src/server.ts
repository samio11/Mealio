import { createServer, type Server } from "node:http";

import { createApp } from "./app/app.ts";
import { env } from "./app/config/env.ts";
import { disconnectDb } from "./app/db/prisma.ts";
import { installBigIntSerializer } from "./app/utils/json.ts";
import { logger } from "./app/utils/logger.ts";

// Money is BigInt; install the serializer before anything can respond with JSON.
installBigIntSerializer();

function registerShutdown(server: Server): void {
  let closing = false;

  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "shutting down");

    server.close(() => {
      void disconnectDb()
        .catch((err: unknown) => logger.error({ err }, "error closing database"))
        .finally(() => process.exit(0));
    });

    // Safety net if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

const app = createApp();
export default app;

if (!process.env.VERCEL) {
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  registerShutdown(server);
}
