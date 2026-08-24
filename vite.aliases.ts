import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = dirname(fileURLToPath(import.meta.url));

export const SOURCE_ALIASES = {
  "@": resolve(WORKSPACE_ROOT, "src"),
  "@client": resolve(WORKSPACE_ROOT, "src/client"),
  "@test": resolve(WORKSPACE_ROOT, "test"),
} as const;
