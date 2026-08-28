export const SOURCE_STRUCTURE_POLICY = Object.freeze({
  ROOTS: ["src", "test"],
  EXTENSIONS: new Set([".ts", ".tsx", ".css"]),
  MAX_DIRECT_FILES_PER_DIRECTORY: 12,
  MAX_PRODUCT_FILE_LINES: 400,
  MAX_TEST_FILE_LINES: 600,
});

export const SOURCE_STRUCTURE_REVIEW_ALLOWLIST = new Map([
  ["src/infrastructure/filesystem/d1-filesystem-repository.ts", "D1 statements remain transactionally cohesive behind segregated repository ports."],
]);
