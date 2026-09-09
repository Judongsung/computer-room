import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoEditor } from "@client/hooks/widgets/memo/use-memo-editor";
import { deferred } from "@test/support/widgets/deferred";

describe("useMemoEditor", () => {
  it("preserves an edited draft and cancels to the latest source", () => {
    const scope = {};
    const onSave = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ markdown }) => useMemoEditor({ scope, markdown, onSave }),
      { initialProps: { markdown: "original" } },
    );
    act(() => {
      result.current.beginEditing();
      result.current.setDraft("draft");
    });
    rerender({ markdown: "new source" });
    expect(result.current.draft).toBe("draft");
    expect(result.current.dirty).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.draft).toBe("new source");
    expect(result.current.editing).toBe(false);
  });

  it("locks saving, ignores editing actions, and applies the latest callback", async () => {
    const save = deferred<{ markdown: string }>();
    const firstSaved = vi.fn();
    const latestSaved = vi.fn();
    const scope = {};
    const { result, rerender } = renderHook(
      ({ onSaved }) => useMemoEditor({
        scope,
        markdown: "original",
        startEditing: true,
        onSave: () => save.promise,
        onSaved,
      }),
      { initialProps: { onSaved: firstSaved } },
    );
    act(() => result.current.setDraft("saved"));
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = result.current.save();
      duplicate = result.current.save();
      result.current.setDraft("ignored");
      result.current.cancel();
    });
    rerender({ onSaved: latestSaved });
    await expect(duplicate).resolves.toBe(false);
    await act(async () => save.resolve({ markdown: "saved" }));
    await expect(first).resolves.toBe(true);
    expect(result.current.editing).toBe(false);
    expect(firstSaved).not.toHaveBeenCalled();
    expect(latestSaved).toHaveBeenCalledOnce();
  });

  it("keeps editing for false or errors and ignores an old scope completion", async () => {
    const old = deferred<boolean>();
    const oldScope = {};
    const nextScope = {};
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(
      ({ scope, markdown, onSave }) => useMemoEditor({ scope, markdown, startEditing: true, onSave, onSaved }),
      { initialProps: { scope: oldScope, markdown: "old", onSave: () => old.promise } },
    );
    act(() => { void result.current.save(); });
    rerender({ scope: nextScope, markdown: "next", onSave: async () => false });
    await act(async () => old.resolve(true));
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.draft).toBe("next");
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.editing).toBe(true);
    act(() => result.current.setDraft("keep this input"));
    rerender({ scope: nextScope, markdown: "next", onSave: async () => { throw new Error("save failed"); } });
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.error).toBe("save failed");
    expect(result.current.draft).toBe("keep this input");
    expect(result.current.editing).toBe(true);
  });
});
