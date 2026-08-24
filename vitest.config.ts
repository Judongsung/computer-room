import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            DEV_AUTH_BYPASS: "true",
            OWNER_EMAIL: "owner@example.com",
            NOVELAI_UPLOAD_POLICY_AUD: "novelai-upload-audience",
            TEST_MIGRATIONS: migrations,
          },
          d1Databases: ["DB", "MIGRATION_REGRESSION_DB"],
          r2Buckets: ["FILES"],
        },
      }),
    ],
    test: {
      include: ["test/**/*.test.ts"],
      exclude: ["test/client/**"],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
