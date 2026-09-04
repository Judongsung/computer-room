import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextDocument } from "@client/components/shared/text/text-document";
import { NOTEPAD_COPY, TEXT_FILE_ERROR_MESSAGE } from "@client/content/ko/filesystem/text/notepad";
import { TEXT_FILE_ERROR_CODE } from "@client/constants/filesystem/text/text-file";
import { fileEntry } from "@test/support/mobile/mobile-app-test-helpers";

const file = fileEntry("text", "file.md", "text/markdown");
const gateway = { downloadUrl: (id: string) => `/download/${id}` };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("read-only text document", () => {
  it("keeps Markdown and HTML as literal text and copies the entire source", async () => {
    const source = "# 제목\n<script>danger()</script>\n  들여쓰기";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(source)));
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<TextDocument file={file} gateway={gateway} />);
    const text = await screen.findByRole("textbox", { name: NOTEPAD_COPY.TEXT_LABEL });
    expect(text).toHaveValue(source);
    expect(text).toHaveAttribute("readonly");
    expect(screen.queryByRole("heading", { name: "제목" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: NOTEPAD_COPY.COPY_ALL }));
    expect(copy).toHaveBeenCalledWith(source);
    expect(screen.getByText(NOTEPAD_COPY.COPIED)).toBeInTheDocument();
  });
  it("reports load errors and retries without exposing server responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("secret", { status: 404 })).mockResolvedValueOnce(new Response("recovered")));
    const user = userEvent.setup();
    render(<TextDocument file={file} gateway={gateway} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXT_FILE_ERROR_MESSAGE[TEXT_FILE_ERROR_CODE.LOAD_FAILED]);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: NOTEPAD_COPY.RETRY }));
    expect(await screen.findByRole("textbox")).toHaveValue("recovered");
  });
  it("aborts closed and replaced reads and ignores their late response", async () => {
    let firstResolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { firstResolve = resolve; }))
      .mockResolvedValueOnce(new Response("new file"));
    vi.stubGlobal("fetch", fetch);
    const { rerender, unmount } = render(<TextDocument file={file} gateway={gateway} />);
    const firstSignal = fetch.mock.calls[0]?.[1].signal as AbortSignal;
    rerender(<TextDocument file={{ ...file, id: "next" }} gateway={gateway} />);
    expect(firstSignal.aborted).toBe(true);
    expect(await screen.findByRole("textbox")).toHaveValue("new file");
    firstResolve(new Response("old file"));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("new file"));
    const lastSignal = fetch.mock.calls.at(-1)?.[1].signal as AbortSignal;
    unmount(); expect(lastSignal.aborted).toBe(true);
  });
  it("keeps selection shortcuts inside the document and reports clipboard refusal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("text")));
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const outerKey = vi.fn();
    render(<div onKeyDown={outerKey}><TextDocument file={file} gateway={gateway} /></div>);
    fireEvent.keyDown(await screen.findByRole("textbox"), { key: "a", ctrlKey: true });
    expect(outerKey).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: NOTEPAD_COPY.COPY_ALL }));
    expect(await screen.findByText(NOTEPAD_COPY.COPY_FAILED)).toBeInTheDocument();
  });
});
