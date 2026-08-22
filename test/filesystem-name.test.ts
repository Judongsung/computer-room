import { describe, expect, it } from "vitest";
import { FILESYSTEM_ERRORS } from "../src/constants/errors/filesystem";
import { MAX_FILE_NAME_BYTES } from "../src/constants/file";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "../src/domain/filesystem-name";

describe("filesystem names", () => {
  it("normalizes Unicode and compares sibling names without case", () => {
    expect(normalizeFilesystemName("  e\u0301.txt  ")).toBe("é.txt");
    expect(filesystemNameKey("REPORT.TXT")).toBe(
      filesystemNameKey("report.txt"),
    );
  });

  it.each(["", ".", "..", "folder/name", "folder\\name", "bad\u0000name"])(
    "rejects the invalid name %j",
    (name) => {
      expect(() => normalizeFilesystemName(name)).toThrowError(
        expect.objectContaining({ code: FILESYSTEM_ERRORS.INVALID_ENTRY_NAME.code }),
      );
    },
  );

  it("numbers a conflict before the extension without exceeding the byte limit", () => {
    const requested = `${"a".repeat(MAX_FILE_NAME_BYTES - 4)}.txt`;
    const numbered = availableFilesystemName(
      requested,
      new Set([filesystemNameKey(requested)]),
    );

    expect(numbered).toMatch(/ \(2\)\.txt$/);
    expect(new TextEncoder().encode(numbered)).toHaveLength(
      MAX_FILE_NAME_BYTES,
    );
  });
});
