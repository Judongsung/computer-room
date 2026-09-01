import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const HTTP_ROOT = "src/http";
const ROUTE_FILE_NAME_PATTERN = /(?:api-handler|api-routes)\.ts$/u;
const INLINE_API_PATH_MARKERS = ['"/api/', "'/api/", "`/api/"];
const CAPTURED_SEGMENT_LITERAL = "([^/]+)";
const EXACT_PATTERN_CONSTRUCTOR = "new RegExp(";
const violations = [];

for (const file of routeFiles(HTTP_ROOT)) {
  const contents = readFileSync(file, "utf8");
  if (contents.includes(CAPTURED_SEGMENT_LITERAL)) {
    violations.push(
      `${displayPath(file)}: use API_ROUTE_PATTERN.CAPTURED_SEGMENT.`,
    );
  }
  if (INLINE_API_PATH_MARKERS.some((marker) => contents.includes(marker))) {
    violations.push(
      `${displayPath(file)}: use the responsibility-specific API path constants.`,
    );
  }
  if (contents.includes(EXACT_PATTERN_CONSTRUCTOR)) {
    violations.push(
      `${displayPath(file)}: use createExactApiRoutePattern for dynamic API routes.`,
    );
  }
}

if (violations.length > 0) {
  console.error("HTTP route boundary check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("HTTP route boundary check passed.");

function routeFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...routeFiles(path));
    } else if (ROUTE_FILE_NAME_PATTERN.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

function displayPath(file) {
  return relative(process.cwd(), file).replaceAll("\\", "/");
}
