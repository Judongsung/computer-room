import { describe, expect, it } from "vitest";
import { FilesystemService } from "@/application/filesystem/filesystem-service";
import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  DEFAULT_FILESYSTEM_DIRECTORY_SORT,
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
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import {
  MemoryDirectorySortRepository,
  MemoryFileRepository,
  SequenceIdGenerator,
  StaticClock,
} from "@test/support/fakes";

describe("filesystem directory sorting", () => {
  it("sorts all supported fields in both directions with directories first", () => {
    const entries = [
      record("directory-alpha", FILESYSTEM_ENTRY_KIND.DIRECTORY, "alpha", {
        createdAt: 100,
        updatedAt: 500,
      }),
      record("directory-zeta", FILESYSTEM_ENTRY_KIND.DIRECTORY, "zeta", {
        createdAt: 200,
        updatedAt: 100,
      }),
      record("widget", FILESYSTEM_ENTRY_KIND.WIDGET, "a-widget", {
        createdAt: 250,
        updatedAt: 250,
        widgetId: "widget-id",
        widgetType: WIDGET_TYPE.MEMO,
      }),
      record("text", FILESYSTEM_ENTRY_KIND.FILE, "b.txt", {
        createdAt: 300,
        updatedAt: 300,
        contentType: "text/plain",
        size: 10,
      }),
      record("image", FILESYSTEM_ENTRY_KIND.FILE, "c.png", {
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

  it("persists one folder preference and keeps stable ordering across pages", async () => {
    const repository = new MemoryFileRepository();
    const directorySorts = new MemoryDirectorySortRepository();
    const service = new FilesystemService(
      repository,
      directorySorts,
      new SequenceIdGenerator([]),
      new StaticClock(0),
    );
    for (let size = 1; size <= 105; size += 1) {
      const entry = record(
        `file-${String(size).padStart(3, "0")}`,
        FILESYSTEM_ENTRY_KIND.FILE,
        `file-${size}.bin`,
        { size, contentType: "application/octet-stream" },
      );
      repository.records.set(entry.id, entry);
    }

    const sort = {
      field: FILESYSTEM_SORT_FIELD.SIZE,
      direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
    } as const;
    await expect(
      service.updateDirectorySort(FILESYSTEM_ROOT_ID.DOCUMENTS, sort),
    ).resolves.toEqual(sort);
    const first = await service.listDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      0,
      100,
    );
    const second = await service.listDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      first.nextOffset ?? 0,
      100,
    );

    expect(first.sort).toEqual(sort);
    expect(first.nextOffset).toBe(100);
    expect(second.nextOffset).toBeNull();
    expect([...first.items, ...second.items].map((entry) => entry.id)).toEqual(
      Array.from(
        { length: 105 },
        (_, index) => `file-${String(105 - index).padStart(3, "0")}`,
      ),
    );
    await expect(
      service.listDirectory(FILESYSTEM_ROOT_ID.DESKTOP, 0, 100),
    ).resolves.toMatchObject({ sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT });
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

function record(
  id: string,
  kind: FilesystemEntryRecord["kind"],
  name: string,
  overrides: Partial<FilesystemEntryRecord> = {},
): FilesystemEntryRecord {
  const isFile = kind === FILESYSTEM_ENTRY_KIND.FILE;
  return {
    id,
    parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    kind,
    name,
    nameKey: name.toLocaleLowerCase(),
    fileId: isFile ? id : null,
    widgetId: null,
    restoreParentId: null,
    restorePath: null,
    trashedAt: null,
    createdAt: 0,
    updatedAt: 0,
    objectKey: isFile ? `files/${id}` : null,
    contentType: isFile ? "application/octet-stream" : null,
    size: isFile ? 0 : null,
    etag: isFile ? "etag" : null,
    fileStatus: isFile ? FILE_STATUS.READY : null,
    widgetType: null,
    widgetOpen: null,
    desktopOrder: null,
    ...overrides,
  };
}
