import "dotenv/config";

import { disconnectDb, db } from "../src/app/db/prisma.ts";
import { logger } from "../src/app/utils/logger.ts";
import { auth } from "../src/modules/auth/auth.ts";
import { seedGroceryCatalogue } from "../src/modules/grocery-catalogue/grocery-catalogue.service.ts";

/**
 * Seeds the platform super admin.
 *
 * The password is hashed by Better-Auth itself (we call its sign-up API rather
 * than writing to the `accounts` table directly), then the user is promoted to
 * `platformRole = ADMIN`. Idempotent: safe to run repeatedly.
 */
async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping super admin seed");
    return;
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.platformRole !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { platformRole: "ADMIN" } });
      logger.info({ email }, "promoted existing user to platform ADMIN");
      return;
    }
    logger.info({ email }, "super admin already present");
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name: "Super Admin" },
  });

  await db.user.update({
    where: { email },
    data: { platformRole: "ADMIN", emailVerified: true },
  });

  logger.info({ email }, "seeded super admin");
}

async function main(): Promise<void> {
  await seedSuperAdmin();
  // The Bangladeshi grocery catalogue is global data shared by every mess, so it
  // is seeded once here and is idempotent thereafter.
  const catalogueCount = await seedGroceryCatalogue();
  logger.info({ count: catalogueCount }, "grocery catalogue is present");
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "seed failed");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDb();
  });
