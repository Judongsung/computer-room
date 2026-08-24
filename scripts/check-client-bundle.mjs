import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { CLIENT_BUNDLE_POLICY } from "./constants/client-bundle-policy.mjs";

const html = readFileSync(CLIENT_BUNDLE_POLICY.INDEX_PATH, "utf8");
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/u);
if (!entryMatch) {
  throw new Error(`Client entry script was not found in ${CLIENT_BUNDLE_POLICY.INDEX_PATH}.`);
}

const entryPath = join(
  dirname(CLIENT_BUNDLE_POLICY.INDEX_PATH),
  entryMatch[1].replace(/^\//u, ""),
);
const entryBytes = statSync(entryPath).size;
if (entryBytes > CLIENT_BUNDLE_POLICY.MAX_ENTRY_BYTES) {
  throw new Error(
    `Client entry bundle is ${entryBytes} bytes; maximum is ${CLIENT_BUNDLE_POLICY.MAX_ENTRY_BYTES} bytes.`,
  );
}

console.log(`Client entry bundle check passed (${entryBytes} bytes).`);
