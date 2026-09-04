import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { SOURCE_ALIASES } from "./vite.aliases.ts";
import {
  TEST_MAX_WORKERS,
  UI_TEST_TIMEOUT_MILLISECONDS,
} from "./test/support/platform/test-runtime.ts";
import {
  CLIENT_TEST_PATTERN,
  CLIENT_UNIT_TEST_PATTERN,
  WORKER_TEST_PATTERNS,
} from "./test/support/platform/test-suites.ts";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: SOURCE_ALIASES },
  test: {
    environment: "jsdom",
    include: [CLIENT_TEST_PATTERN],
    exclude: [CLIENT_UNIT_TEST_PATTERN, ...WORKER_TEST_PATTERNS],
    setupFiles: ["./test/client/setup.ts"],
    testTimeout: UI_TEST_TIMEOUT_MILLISECONDS,
    maxWorkers: TEST_MAX_WORKERS,
  },
});
