import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { SOURCE_ALIASES } from "./vite.aliases.ts";
import {
  CLIENT_TEST_MAX_WORKERS,
  CLIENT_TEST_TIMEOUT_MILLISECONDS,
} from "./test/support/platform/client-test-runtime.ts";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: SOURCE_ALIASES },
  test: {
    environment: "jsdom",
    include: ["test/client/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/client/setup.ts"],
    testTimeout: CLIENT_TEST_TIMEOUT_MILLISECONDS,
    maxWorkers: CLIENT_TEST_MAX_WORKERS,
  },
});
