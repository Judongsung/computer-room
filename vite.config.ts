import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SOURCE_ALIASES } from "./vite.aliases.ts";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: { alias: SOURCE_ALIASES },
  build: {
    cssMinify: "esbuild",
  },
});
