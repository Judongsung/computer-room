import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const CLIENT_ROOT = resolve("src/client");
const CONTENT_ROOT = resolve("src/client/content/ko");
const CONSTANTS_ROOT = resolve("src/client/constants");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const KOREAN_TEXT_PATTERN = /[\uac00-\ud7a3]/u;
const CONTENT_IMPORT_PATTERN = /(?:from\s+|import\s*)["']@client\/content\/ko(?:\/|["'])/u;

const violations = [];

for (const file of sourceFiles(CLIENT_ROOT)) {
  const contents = readFileSync(file, "utf8");
  if (!file.startsWith(CONTENT_ROOT) && KOREAN_TEXT_PATTERN.test(contents)) {
    violations.push(
      `${displayPath(file)}: Korean UI text must be owned by src/client/content/ko.`,
    );
  }
  if (file.startsWith(CONSTANTS_ROOT) && CONTENT_IMPORT_PATTERN.test(contents)) {
    violations.push(
      `${displayPath(file)}: client constants must not import UI content.`,
    );
  }
}

if (violations.length > 0) {
  console.error("Client content boundary check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Client content boundary check passed.");

function sourceFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
      continue;
    }
    const extension = name.slice(name.lastIndexOf("."));
    if (SOURCE_EXTENSIONS.has(extension)) files.push(path);
  }
  return files;
}

function displayPath(file) {
  return relative(process.cwd(), file).replaceAll("\\", "/");
}
