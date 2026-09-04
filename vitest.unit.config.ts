import { defineConfig } from "vitest/config";
import { SOURCE_ALIASES } from "./vite.aliases.ts";
import { TEST_MAX_WORKERS } from "./test/support/platform/test-runtime.ts";
import {
  UNIT_TEST_PATTERNS,
  WORKER_TEST_PATTERNS,
} from "./test/support/platform/test-suites.ts";

export default defineConfig({
  resolve: { alias: SOURCE_ALIASES },
  test: {
    environment: "node",
    include: [...UNIT_TEST_PATTERNS],
    exclude: [...WORKER_TEST_PATTERNS],
    maxWorkers: TEST_MAX_WORKERS,
  },
});
