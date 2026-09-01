import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import {
  SOURCE_STRUCTURE_POLICY,
  SOURCE_STRUCTURE_REVIEW_ALLOWLIST,
} from "./constants/source-structure-policy.mjs";

const normalize = (path) => path.replaceAll("\\", "/");
const violations = [];
const reviews = [];

for (const root of SOURCE_STRUCTURE_POLICY.ROOTS) inspectDirectory(root);

if (reviews.length > 0) {
  console.warn("Structure review allowlist:");
  for (const review of reviews) console.warn(`- ${review}`);
}

if (violations.length > 0) {
  console.error("Source structure check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Source structure check passed.");

function inspectDirectory(directory) {
  const projectDirectory = normalize(relative(process.cwd(), directory));
  if (SOURCE_STRUCTURE_POLICY.EXCLUDED_DIRECTORIES.has(projectDirectory)) return;

  const entries = readdirSync(directory, { withFileTypes: true });
  const productFiles = entries.filter(
    (entry) => entry.isFile() && SOURCE_STRUCTURE_POLICY.EXTENSIONS.has(extname(entry.name)),
  );
  if (productFiles.length > SOURCE_STRUCTURE_POLICY.MAX_DIRECT_FILES_PER_DIRECTORY) {
    violations.push(
      `${normalize(directory)} contains ${productFiles.length} direct source files (maximum ${SOURCE_STRUCTURE_POLICY.MAX_DIRECT_FILES_PER_DIRECTORY}).`,
    );
  }

  for (const entry of productFiles) inspectFile(join(directory, entry.name));
  for (const entry of entries) {
    if (entry.isDirectory()) inspectDirectory(join(directory, entry.name));
  }
}

function inspectFile(path) {
  const projectPath = normalize(relative(process.cwd(), path));
  const lineCount = readFileSync(path, "utf8").split(/\r?\n/u).length;
  const threshold = projectPath.startsWith("test/")
    ? SOURCE_STRUCTURE_POLICY.MAX_TEST_FILE_LINES
    : SOURCE_STRUCTURE_POLICY.MAX_PRODUCT_FILE_LINES;
  if (lineCount <= threshold) return;

  const reason = SOURCE_STRUCTURE_REVIEW_ALLOWLIST.get(projectPath);
  if (!reason) {
    violations.push(`${projectPath} has ${lineCount} lines and requires a responsibility review or an allowlist reason.`);
    return;
  }
  reviews.push(`${projectPath} (${lineCount} lines): ${reason}`);
}
