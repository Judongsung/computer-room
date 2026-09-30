import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import type { MemoVersion, MemoVersionList } from "@/types/widgets/memo";
import { ApiError } from "@client/errors/api-error";
import { useMemoHistory } from "@client/hooks/widgets/memo/use-memo-history";
import type { MemoHistoryGateway } from "@client/types/widgets/ports/memo";
import { deferred } from "@test/support/widgets/deferred";

const versions: MemoVersionList = { items: [
  { version: 2, savedAt: "2026-09-20T00:00:00.000Z" },
  { version: 1, savedAt: null },
] };

describe("useMemoHistory", () => {
  it("loads the newest version, retries a failed list, and avoids duplicate reads", async () => {
    const list = deferred<MemoVersionList>();
    const gateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn(() => list.promise),
      getMemoVersion: vi.fn(async (_id, version) => ({ version, savedAt: null, markdown: "latest" })),
    };
    const { result } = renderHook(() => useMemoHistory("memo", gateway));
    act(() => result.current.reloadList());
    expect(gateway.listMemoVersions).toHaveBeenCalledTimes(1);
    await act(async () => list.reject(new Error("network unavailable")));
    expect(result.current.listError).toBe("network unavailable");
    const retry = deferred<MemoVersionList>();
    const detail = deferred<MemoVersion>();
    gateway.listMemoVersions = vi.fn(() => retry.promise);
    gateway.getMemoVersion = vi.fn(() => detail.promise);
    act(() => result.current.reloadList());
    expect(result.current.listLoading).toBe(true);
    await act(async () => { retry.resolve(versions); await retry.promise; });
    expect(result.current.detailLoading).toBe(true);
    await act(async () => { detail.resolve({ version: 2, savedAt: null, markdown: "latest" }); await detail.promise; });
    expect(result.current.detail?.markdown).toBe("latest");
    expect(result.current.selectedVersion).toBe(2);
    expect(gateway.getMemoVersion).toHaveBeenCalledWith("memo", 2);
  });

  it("hides old content on selection and ignores reverse completion", async () => {
    const list = deferred<MemoVersionList>();
    const first = deferred<MemoVersion>();
    const second = deferred<MemoVersion>();
    const gateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn(() => list.promise),
      getMemoVersion: vi.fn((_id, version) => version === 2 ? first.promise : second.promise),
    };
    const { result } = renderHook(() => useMemoHistory("memo", gateway));
    await act(async () => { list.resolve(versions); await list.promise; });
    expect(result.current.selectedVersion).toBe(2);
    act(() => { result.current.select(2); result.current.select(1); });
    expect(gateway.getMemoVersion).toHaveBeenCalledTimes(2);
    expect(result.current.detail).toBeNull();
    await act(async () => first.resolve({ version: 2, savedAt: null, markdown: "old response" }));
    expect(result.current.detail).toBeNull();
    await act(async () => second.resolve({ version: 1, savedAt: null, markdown: "selected" }));
    expect(result.current.detail?.markdown).toBe("selected");
  });

  it("keeps expired detail unloaded until an explicit list reload", async () => {
    const list = deferred<MemoVersionList>();
    const retry = deferred<MemoVersionList>();
    const detail = deferred<MemoVersion>();
    const expired = new ApiError(MEMO_ERRORS.VERSION_NOT_FOUND.code, MEMO_ERRORS.VERSION_NOT_FOUND.message, 404);
    const gateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn().mockReturnValueOnce(list.promise).mockReturnValueOnce(retry.promise),
      getMemoVersion: vi.fn(() => detail.promise),
    };
    const { result } = renderHook(() => useMemoHistory("memo", gateway));
    await act(async () => { list.resolve(versions); await list.promise; });
    expect(result.current.detailLoading).toBe(true);
    await act(async () => detail.reject(expired));
    expect(result.current.expired).toBe(true);
    act(() => result.current.retryDetail());
    expect(gateway.getMemoVersion).toHaveBeenCalledTimes(1);
    act(() => result.current.reloadList());
    expect(gateway.listMemoVersions).toHaveBeenCalledTimes(2);
    await act(async () => { retry.resolve(versions); await retry.promise; });
  });

  it("retries a transient detail failure and ignores a late failure after unmount", async () => {
    const list = deferred<MemoVersionList>();
    const failed = deferred<MemoVersion>();
    const recovered = deferred<MemoVersion>();
    const late = deferred<MemoVersion>();
    const gateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn(() => list.promise),
      getMemoVersion: vi.fn()
        .mockReturnValueOnce(failed.promise)
        .mockReturnValueOnce(recovered.promise)
        .mockImplementationOnce(() => late.promise),
    };
    const { result, unmount } = renderHook(() => useMemoHistory("memo", gateway));
    await act(async () => { list.resolve(versions); await list.promise; });
    await act(async () => failed.reject(new Error("temporary failure")));
    expect(result.current.detailError).toBe("temporary failure");
    expect(result.current.detail).toBeNull();
    act(() => result.current.retryDetail());
    expect(result.current.detailLoading).toBe(true);
    await act(async () => { recovered.resolve({ version: 2, savedAt: null, markdown: "recovered" }); await recovered.promise; });
    expect(result.current.detail?.markdown).toBe("recovered");
    act(() => result.current.select(1));
    expect(result.current.detail).toBeNull();
    unmount();
    await act(async () => late.reject(new Error("late failure")));
    expect(gateway.getMemoVersion).toHaveBeenCalledTimes(3);
  });

  it("discards old widget and gateway responses, including after unmount", async () => {
    const oldList = deferred<MemoVersionList>();
    const oldGateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn(() => oldList.promise),
      getMemoVersion: vi.fn(async () => ({ version: 2, savedAt: null, markdown: "old" })),
    };
    const list = deferred<MemoVersionList>();
    const detail = deferred<MemoVersion>();
    const newGateway: MemoHistoryGateway = {
      listMemoVersions: vi.fn(() => list.promise),
      getMemoVersion: vi.fn(() => detail.promise),
    };
    const { result, rerender, unmount } = renderHook(
      ({ id, gateway }) => useMemoHistory(id, gateway),
      { initialProps: { id: "old", gateway: oldGateway } },
    );
    rerender({ id: "new", gateway: newGateway });
    expect(result.current.listLoading).toBe(true);
    await act(async () => { list.resolve({ items: [{ version: 1, savedAt: null }] }); await list.promise; });
    expect(result.current.detailLoading).toBe(true);
    await act(async () => { detail.resolve({ version: 1, savedAt: null, markdown: "new" }); await detail.promise; });
    expect(result.current.detail?.markdown).toBe("new");
    await act(async () => oldList.resolve(versions));
    expect(result.current.detail?.markdown).toBe("new");
    expect(oldGateway.getMemoVersion).not.toHaveBeenCalled();
    unmount();
  });
});
