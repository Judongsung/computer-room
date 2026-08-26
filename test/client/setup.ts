import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { CLIENT_TEST_TIMEOUT_MILLISECONDS } from "@test/support/platform/client-test-runtime";

afterEach(() => cleanup());

configure({ asyncUtilTimeout: CLIENT_TEST_TIMEOUT_MILLISECONDS });
