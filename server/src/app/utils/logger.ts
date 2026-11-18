import { pino } from "pino";

import { env, isProd } from "../config/env.ts";

export const logger = pino({
  level: isProd ? "info" : "debug",
  base: { service: "mess-server", env: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.secret",
      "*.apiKey",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
