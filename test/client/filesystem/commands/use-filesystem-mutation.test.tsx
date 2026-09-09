import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFilesystemMutation } from "@client/hooks/filesystem/commands/use-filesystem-mutation";
import { deferred } from "@test/support/widgets/deferred";

describe("useFilesystemMutation", () => {
  it("locks before the operation starts and retries after a failure", async () => {
    const first = deferred<string>();
    const operation = vi.fn(() => first.promise);
    const applied = vi.fn();
    const gateway = {};
    const { result } = renderHook(() => useFilesystemMutation(gateway));

    let accepted!: Promise<unknown>;
    let ignored!: Promise<unknown>;
    act(() => {
      accepted = result.current.run(operation, applied);
      ignored = result.current.run(operation, applied);
    });
    expect(operation).toHaveBeenCalledOnce();
    await expect(ignored).resolves.toEqual({ status: "ignored" });

    await act(async () => first.reject(new Error("failed")));
    await expect(accepted).resolves.toEqual({ status: "failed" });
    expect(result.current.error).toBe("failed");

    await act(async () => {
      await result.current.run(async () => "retried", applied);
    });
    expect(applied).toHaveBeenCalledExactlyOnceWith("retried");
    expect(result.current.error).toBeNull();
  });

  it("ignores completion after a gateway lifetime changes or unmounts", async () => {
    const old = deferred<string>();
    const onSuccess = vi.fn();
    const firstGateway = {};
    const nextGateway = {};
    const { result, rerender, unmount } = renderHook(
      ({ gateway }) => useFilesystemMutation(gateway),
      { initialProps: { gateway: firstGateway } },
    );
    let request!: Promise<unknown>;
    act(() => { request = result.current.run(() => old.promise, onSuccess); });
    rerender({ gateway: nextGateway });
    await act(async () => old.resolve("old"));
    await expect(request).resolves.toEqual({ status: "ignored" });
    expect(onSuccess).not.toHaveBeenCalled();

    const pending = deferred<string>();
    act(() => { void result.current.run(() => pending.promise, onSuccess); });
    unmount();
    await act(async () => pending.resolve("unmounted"));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
