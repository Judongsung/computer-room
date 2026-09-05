import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { SOURCE_ALIASES } from "./vite.aliases.ts";
import { WORKER_TEST_PATTERNS } from "./test/support/platform/test-suites.ts";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");

  return {
    resolve: { alias: SOURCE_ALIASES },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            DEV_AUTH_BYPASS: "true",
            OWNER_EMAIL: "owner@example.com",
            INTEGRATION_UPLOAD_POLICY_AUD: "integration-upload-audience",
            NOVELAI_UPLOAD_POLICY_AUD: "novelai-upload-audience",
            TEST_MIGRATIONS: migrations,
          },
          d1Databases: [
            "DB",
            "MIGRATION_REGRESSION_DB",
            "INDEX_RETENTION_TEST_DB",
            "FILESYSTEM_REPOSITORY_TEST_DB",
            "GUEST_ACCESS_TEST_DB",
            "IMAGE_UPLOAD_LOG_TEST_DB",
          ],
          r2Buckets: ["FILES"],
        },
      }),
    ],
    test: {
      include: [...WORKER_TEST_PATTERNS],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
