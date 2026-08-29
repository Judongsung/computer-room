import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FILE_UPLOAD_COMPENSATION_LOG_EVENT,
  FILE_UPLOAD_COMPENSATION_STEP,
} from "@/constants/filesystem/observability";
import { ConsoleFileUploadCompensationObserver } from "@/infrastructure/filesystem/console-file-upload-compensation-observer";

afterEach(() => vi.restoreAllMocks());

describe("ConsoleFileUploadCompensationObserver", () => {
  it("logs structured failure metadata without the error message", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const observer = new ConsoleFileUploadCompensationObserver();

    observer.report({
      entryId: "opaque-entry-id",
      failures: [
        {
          step: FILE_UPLOAD_COMPENSATION_STEP.OBJECT_STORAGE_DELETE,
          cause: new Error("private-file-name.png"),
        },
      ],
    });

    expect(consoleError).toHaveBeenCalledOnce();
    const payload = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(payload)).toEqual({
      event: FILE_UPLOAD_COMPENSATION_LOG_EVENT,
      entryId: "opaque-entry-id",
      failures: [
        {
          step: FILE_UPLOAD_COMPENSATION_STEP.OBJECT_STORAGE_DELETE,
          errorType: "Error",
        },
      ],
    });
    expect(payload).not.toContain("private-file-name.png");
  });
});
