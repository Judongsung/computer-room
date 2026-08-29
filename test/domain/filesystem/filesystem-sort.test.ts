import { describe, expect, it } from "vitest";
import {
  FILESYSTEM_ENTRY_KIND,
} from "@/constants/filesystem/filesystem";
import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_DIRECTION_VALUES,
  FILESYSTEM_SORT_FIELD,
  FILESYSTEM_SORT_FIELD_VALUES,
} from "@/constants/filesystem/sort";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  compareFilesystemEntries,
  requireFilesystemDirectorySort,
} from "@/domain/filesystem/filesystem-sort";
import type {
  FilesystemDirectorySort,
} from "@/types/filesystem/filesystem";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";

describe("filesystem directory sorting", () => {
  it("sorts all supported fields in both directions with directories first", () => {
    const entries = [
      filesystemEntryRecord("directory-alpha", FILESYSTEM_ENTRY_KIND.DIRECTORY, "alpha", {
        createdAt: 100,
        updatedAt: 500,
      }),
      filesystemEntryRecord("directory-zeta", FILESYSTEM_ENTRY_KIND.DIRECTORY, "zeta", {
        createdAt: 200,
        updatedAt: 100,
      }),
      filesystemEntryRecord("widget", FILESYSTEM_ENTRY_KIND.WIDGET, "a-widget", {
        createdAt: 250,
        updatedAt: 250,
        widgetId: "widget-id",
        widgetType: WIDGET_TYPE.MEMO,
      }),
      filesystemEntryRecord("text", FILESYSTEM_ENTRY_KIND.FILE, "b.txt", {
        createdAt: 300,
        updatedAt: 300,
        contentType: "text/plain",
        size: 10,
      }),
      filesystemEntryRecord("image", FILESYSTEM_ENTRY_KIND.FILE, "c.png", {
        createdAt: 400,
        updatedAt: 400,
        contentType: "image/png",
        size: 5,
      }),
    ];
    const expected = new Map<string, readonly string[]>([
      [key(FILESYSTEM_SORT_FIELD.NAME, FILESYSTEM_SORT_DIRECTION.ASCENDING), [
        "directory-alpha", "directory-zeta", "widget", "text", "image",
      ]],
      [key(FILESYSTEM_SORT_FIELD.NAME, FILESYSTEM_SORT_DIRECTION.DESCENDING), [
        "directory-zeta", "directory-alpha", "image", "text", "widget",
      ]],
      [key(FILESYSTEM_SORT_FIELD.CREATED_AT, FILESYSTEM_SORT_DIRECTION.ASCENDING), [
        "directory-alpha", "directory-zeta", "widget", "text", "image",
      ]],
      [key(FILESYSTEM_SORT_FIELD.CREATED_AT, FILESYSTEM_SORT_DIRECTION.DESCENDING), [
        "directory-zeta", "directory-alpha", "image", "text", "widget",
      ]],
      [key(FILESYSTEM_SORT_FIELD.UPDATED_AT, FILESYSTEM_SORT_DIRECTION.ASCENDING), [
        "directory-zeta", "directory-alpha", "widget", "text", "image",
      ]],
      [key(FILESYSTEM_SORT_FIELD.UPDATED_AT, FILESYSTEM_SORT_DIRECTION.DESCENDING), [
        "directory-alpha", "directory-zeta", "image", "text", "widget",
      ]],
      [key(FILESYSTEM_SORT_FIELD.TYPE, FILESYSTEM_SORT_DIRECTION.ASCENDING), [
        "directory-alpha", "directory-zeta", "image", "text", "widget",
      ]],
      [key(FILESYSTEM_SORT_FIELD.TYPE, FILESYSTEM_SORT_DIRECTION.DESCENDING), [
        "directory-alpha", "directory-zeta", "widget", "text", "image",
      ]],
      [key(FILESYSTEM_SORT_FIELD.SIZE, FILESYSTEM_SORT_DIRECTION.ASCENDING), [
        "directory-alpha", "directory-zeta", "image", "text", "widget",
      ]],
      [key(FILESYSTEM_SORT_FIELD.SIZE, FILESYSTEM_SORT_DIRECTION.DESCENDING), [
        "directory-alpha", "directory-zeta", "text", "image", "widget",
      ]],
    ]);

    for (const field of FILESYSTEM_SORT_FIELD_VALUES) {
      for (const direction of FILESYSTEM_SORT_DIRECTION_VALUES) {
        const sort = { field, direction };
        expect(
          [...entries]
            .sort((left, right) => compareFilesystemEntries(left, right, sort))
            .map((entry) => entry.id),
        ).toEqual(expected.get(key(field, direction)));
      }
    }
  });

  it("rejects unknown sort contracts at the domain boundary", () => {
    expect(() =>
      requireFilesystemDirectorySort({
        field: "unknown",
        direction: FILESYSTEM_SORT_DIRECTION.ASCENDING,
      }),
    ).toThrowError("폴더 정렬 설정이 올바르지 않습니다.");
  });
});

function key(
  field: FilesystemDirectorySort["field"],
  direction: FilesystemDirectorySort["direction"],
): string {
  return `${field}:${direction}`;
}
