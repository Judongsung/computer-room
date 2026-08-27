export const SOURCE_STRUCTURE_POLICY = Object.freeze({
  ROOTS: ["src", "test"],
  EXTENSIONS: new Set([".ts", ".tsx", ".css"]),
  MAX_DIRECT_FILES_PER_DIRECTORY: 12,
  MAX_PRODUCT_FILE_LINES: 400,
  MAX_TEST_FILE_LINES: 600,
});

export const SOURCE_STRUCTURE_REVIEW_ALLOWLIST = new Map([
  ["src/client/components/desktop/desktop-shell.tsx", "Top-level desktop event wiring remains centralized after state, lifecycle, window, and dialog extraction."],
  ["src/client/components/filesystem/documents-window.tsx", "Explorer commands share one selection and dialog transaction boundary; further extraction is tracked by this warning."],
  ["src/client/components/filesystem/recycle-bin-window.tsx", "The file is a single recycle-bin view and only narrowly exceeds the review threshold."],
  ["src/infrastructure/filesystem/d1-filesystem-repository.ts", "D1 statements remain transactionally cohesive behind segregated repository ports."],
]);
