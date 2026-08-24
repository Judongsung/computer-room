import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { SOURCE_ALIASES } from "./vite.aliases.ts";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: SOURCE_ALIASES },
  test: {
    environment: "jsdom",
    include: ["test/client/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/client/setup.ts"],
  },
});
