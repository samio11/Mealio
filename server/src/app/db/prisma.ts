import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client.ts";
import { env, isProd } from "../config/env.ts";

/**
 * Prisma 7 uses driver adapters + the new query compiler (no Rust query engine).
 * The pg adapter owns the connection pool.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const db = new PrismaClient({
  adapter,
  log: isProd ? ["error"] : ["warn", "error"],
});

export type Db = typeof db;

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
}
