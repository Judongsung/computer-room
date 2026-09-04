import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vitest";
import { UI_TEST_TIMEOUT_MILLISECONDS } from "@test/support/platform/test-runtime";

// Install once per isolated test file so restoring a test's explicit spy returns
// to this guard. Expected errors must be intercepted and asserted by that test.
const reportError = console.error.bind(console);
let unexpectedErrors: unknown[][] = [];
console.error = (...args: unknown[]): void => {
  unexpectedErrors.push(args);
  reportError(...args);
};

beforeEach(() => { unexpectedErrors = []; });
afterEach(() => {
  cleanup();
  expect(unexpectedErrors, "Unexpected console.error during UI test").toEqual([]);
});

configure({ asyncUtilTimeout: UI_TEST_TIMEOUT_MILLISECONDS });
