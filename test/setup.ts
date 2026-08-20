import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  const testEnv = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});
