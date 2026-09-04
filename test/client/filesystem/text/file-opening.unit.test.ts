import { describe, expect, it, vi } from "vitest";
import { FILE_OPEN_KIND, TEXT_FILE_EXTENSIONS } from "@client/constants/filesystem/text/file-opening";
import { createFileOpener, fileOpenKind } from "@client/domain/filesystem/text/file-opening";
import { fileEntry } from "@test/support/filesystem/file-entry";

describe("file associations", () => {
  it.each(TEXT_FILE_EXTENSIONS)("opens .%s as plain text even with binary MIME", (extension) => {
    expect(fileOpenKind({ name: `한글.${extension.toUpperCase()}`, contentType: "application/octet-stream" })).toBe(FILE_OPEN_KIND.TEXT);
  });
  it.each(["text/plain; charset=utf-8", "TEXT/MARKDOWN", "application/json", "application/xml", "application/yaml", "application/toml"])("accepts %s without an extension", (contentType) => {
    expect(fileOpenKind({ name: "문서", contentType })).toBe(FILE_OPEN_KIND.TEXT);
  });
  it("keeps media first and unknown or unsupported media as a download request", () => {
    expect(fileOpenKind({ name: "photo.txt", contentType: "image/png" })).toBe(FILE_OPEN_KIND.IMAGE);
    expect(fileOpenKind({ name: "video.json", contentType: "video/mp4" })).toBe(FILE_OPEN_KIND.VIDEO);
    expect(fileOpenKind({ name: "vector.txt", contentType: "image/svg+xml" })).toBe(FILE_OPEN_KIND.DOWNLOAD);
    expect(fileOpenKind({ name: "archive.zip", contentType: "application/zip" })).toBe(FILE_OPEN_KIND.DOWNLOAD);
  });
  it("dispatches through the common handlers without starting a download itself", () => {
    const handlers = { media: vi.fn(), text: vi.fn(), download: vi.fn() };
    const open = createFileOpener(handlers);
    const text = fileEntry("text", "file.md", "text/markdown");
    const binary = fileEntry("binary", "file.bin", "application/octet-stream");
    open(text); open(binary);
    expect(handlers.text).toHaveBeenCalledWith(text);
    expect(handlers.download).toHaveBeenCalledWith(binary);
    expect(handlers.media).not.toHaveBeenCalled();
  });
});
