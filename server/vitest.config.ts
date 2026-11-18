import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one remote database, so files run sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: "test" },
  },
});
