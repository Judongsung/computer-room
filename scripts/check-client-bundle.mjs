import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BUNDLE_POLICY } from "./constants/client-bundle-policy.mjs";

const manifest = JSON.parse(
  readFileSync(CLIENT_BUNDLE_POLICY.MANIFEST_PATH, "utf8"),
);

for (const [interfaceName, interfaceSource] of Object.entries(
  CLIENT_BUNDLE_POLICY.INTERFACE_SOURCES,
)) {
  const files = collectStaticJavaScript([
    CLIENT_BUNDLE_POLICY.ENTRY_SOURCE,
    interfaceSource,
  ]);
  const bytes = [...files].reduce(
    (total, file) =>
      total + statSync(join(CLIENT_BUNDLE_POLICY.OUTPUT_DIRECTORY, file)).size,
    0,
  );
  if (bytes > CLIENT_BUNDLE_POLICY.MAX_INTERFACE_BYTES) {
    throw new Error(
      `${interfaceName} initial JavaScript is ${bytes} bytes; maximum is ${CLIENT_BUNDLE_POLICY.MAX_INTERFACE_BYTES} bytes.`,
    );
  }
  console.log(
    `${interfaceName} initial JavaScript check passed (${bytes} bytes across ${files.size} files).`,
  );
}

function collectStaticJavaScript(entrySources) {
  const visitedSources = new Set();
  const files = new Set();
  const visit = (source) => {
    if (visitedSources.has(source)) return;
    const chunk = manifest[source];
    if (!chunk || typeof chunk !== "object") {
      throw new Error(`Bundle manifest entry was not found for ${source}.`);
    }
    visitedSources.add(source);
    if (typeof chunk.file === "string" && chunk.file.endsWith(".js")) {
      files.add(chunk.file);
    }
    for (const importedSource of chunk.imports ?? []) {
      visit(importedSource);
    }
  };

  for (const source of entrySources) visit(source);
  return files;
}
