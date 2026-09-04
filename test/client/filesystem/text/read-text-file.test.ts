import { afterEach, describe, expect, it, vi } from "vitest";
import { readTextFile } from "@client/api/filesystem/text/read-text-file";
import { TEXT_FILE_ERROR_CODE, TEXT_FILE_MAX_BYTES } from "@client/constants/filesystem/text/text-file";
import { fileEntry } from "@test/support/mobile/mobile-app-test-helpers";

const file = fileEntry("text", "문서.txt", "text/plain");
const gateway = { downloadUrl: (id: string) => `/download/${id}` };
const read = (entry = file, signal = new AbortController().signal) => readTextFile(gateway, entry, signal);
afterEach(() => vi.unstubAllGlobals());

describe("bounded UTF-8 file reads", () => {
  it.each(["", "한글 😀\r\n  공백\t유지\n", "\uFEFF# 제목\n**원문**", '<script>alert("x")</script>'])
  ("reads the source without parsing it: %s", async (source) => {
    const fetch = vi.fn().mockResolvedValue(new Response(source));
    vi.stubGlobal("fetch", fetch);
    expect(await read()).toBe(source.replace(/^\uFEFF/, ""));
    expect(fetch).toHaveBeenCalledWith("/download/text", expect.objectContaining({ cache: "no-store", redirect: "error", credentials: "same-origin" }));
  });
  it("decodes a multibyte character split across chunks", async () => {
    const bytes = new TextEncoder().encode("한글😀");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); },
    }))));
    expect(await read()).toBe("한글😀");
  });
  it("rejects oversized metadata before any request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(read({ ...file, size: TEXT_FILE_MAX_BYTES + 1 })).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.TOO_LARGE });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks response length and actual bytes even when metadata is stale", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("", { headers: { "Content-Length": String(TEXT_FILE_MAX_BYTES + 1) } }))
      .mockResolvedValueOnce(new Response("x".repeat(TEXT_FILE_MAX_BYTES + 1)));
    vi.stubGlobal("fetch", fetch);
    await expect(read()).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.TOO_LARGE });
    await expect(read()).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.TOO_LARGE });
  });
  it("allows the exact byte limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a".repeat(TEXT_FILE_MAX_BYTES))));
    expect((await read()).length).toBe(TEXT_FILE_MAX_BYTES);
  });
  it.each([[0xff], [0xe3, 0x81], [65, 0, 66]])("rejects invalid encoding and NUL: %s", async (...bytes) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(bytes))));
    await expect(read()).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.INVALID_ENCODING });
  });
  it.each([401, 403, 404, 500])("does not expose a %s response body", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private diagnostic", { status })));
    await expect(read()).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.LOAD_FAILED });
  });
  it("passes cancellation to fetch and cancels an oversized stream", async () => {
    const cancel = vi.fn();
    const fetch = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(TEXT_FILE_MAX_BYTES + 1)); }, cancel,
    })));
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    await expect(read(file, abort.signal)).rejects.toMatchObject({ code: TEXT_FILE_ERROR_CODE.TOO_LARGE });
    expect(fetch.mock.calls[0]?.[1].signal).toBe(abort.signal);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
