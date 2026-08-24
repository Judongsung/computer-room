import { describe, expect, it } from "vitest";
import {
  changeFilesystemSelection,
  orderedSelectedIds,
} from "@client/domain/filesystem/selection";

const ORDER = ["a", "b", "c", "d"] as const;

describe("filesystem selection", () => {
  it("replaces, toggles, and extends a Windows-style range", () => {
    const plain = changeFilesystemSelection(
      new Set(["a"]),
      ORDER,
      "b",
      "a",
      { toggle: false, range: false },
    );
    expect([...plain.selectedIds]).toEqual(["b"]);

    const toggled = changeFilesystemSelection(
      plain.selectedIds,
      ORDER,
      "d",
      plain.anchorId,
      { toggle: true, range: false },
    );
    expect(orderedSelectedIds(toggled.selectedIds, ORDER)).toEqual(["b", "d"]);

    const range = changeFilesystemSelection(
      toggled.selectedIds,
      ORDER,
      "b",
      toggled.anchorId,
      { toggle: false, range: true },
    );
    expect(orderedSelectedIds(range.selectedIds, ORDER)).toEqual(["b", "c", "d"]);
  });

  it("adds a range when Ctrl and Shift are held together", () => {
    const result = changeFilesystemSelection(
      new Set(["a"]),
      ORDER,
      "d",
      "b",
      { toggle: true, range: true },
    );

    expect(orderedSelectedIds(result.selectedIds, ORDER)).toEqual(ORDER);
  });
});
