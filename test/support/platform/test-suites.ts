export const CLIENT_UNIT_TEST_PATTERN = "test/client/**/*.unit.test.ts";

export const WORKER_TEST_PATTERNS = [
  "test/http/integration/**/*.test.ts",
  "test/infrastructure/**/d1-*.test.ts",
  "test/infrastructure/**/*-migration.test.ts",
  "test/**/*.worker.test.ts",
] as const;

export const UNIT_TEST_PATTERNS = [
  "test/{application,domain,http,infrastructure}/**/*.test.ts",
  CLIENT_UNIT_TEST_PATTERN,
] as const;

export const CLIENT_TEST_PATTERN = "test/client/**/*.test.{ts,tsx}";
