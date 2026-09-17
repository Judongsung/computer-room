import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { API_PATH_SEGMENTS, FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { FilesystemDirectoryEntry, FilesystemDirectoryPage, FilesystemDirectorySort, FilesystemEntry, FilesystemFileEntry, FilesystemTrashPage, FilesystemWidgetEntry, MoveFilesystemEntryInput, UpdateFilesystemEntryInput } from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

export class FakeFilesystemGateway implements FilesystemGateway {
  private readonly entries: FilesystemEntry[] = [];
  private readonly trash: Array<FilesystemTrashPage["items"][number]> = [];
  private readonly directorySorts = new Map<
    string,
    FilesystemDirectorySort
  >();
  private nextId = 1;
  private readonly root: FilesystemDirectoryEntry = {
    id: FILESYSTEM_ROOT_ID.DOCUMENTS,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "내 문서",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    desktopOrder: null,
  };
  private readonly desktopRoot: FilesystemDirectoryEntry = {
    id: FILESYSTEM_ROOT_ID.DESKTOP,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "바탕 화면",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    desktopOrder: null,
  };

  addFile(
    name: string,
    contentType: string,
    parentId = this.root.id,
  ): FilesystemFileEntry {
    const entry: FilesystemFileEntry = {
      id: `file-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name,
      contentType,
      size: 10,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder:
        parentId === this.desktopRoot.id
          ? this.entries.filter(
              (candidate) => candidate.parentId === this.desktopRoot.id,
            ).length
          : null,
    };
    this.entries.push(entry);
    return entry;
  }

  addWidgetFile(widget: DashboardWidget): FilesystemWidgetEntry {
    if (!widget.file) throw new Error("Widget file reference is required");
    const entry: FilesystemWidgetEntry = {
      id: widget.file.entryId,
      parentId: widget.file.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: widget.file.name,
      widgetId: widget.id,
      widgetType: widget.type,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(entry);
    return entry;
  }

  async listDirectory(parentId = this.root.id): Promise<FilesystemDirectoryPage> {
    const directory =
      parentId === this.desktopRoot.id
        ? this.desktopRoot
        : parentId === this.root.id
          ? this.root
        : (this.entries.find(
            (entry): entry is FilesystemDirectoryEntry =>
              entry.id === parentId &&
              entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
          ) ?? this.root);
    return {
      directory,
      breadcrumbs:
        directory.id === this.root.id
          ? [{ id: this.root.id, name: this.root.name }]
          : [
              { id: this.root.id, name: this.root.name },
              { id: directory.id, name: directory.name },
            ],
      items: this.entries.filter((entry) => entry.parentId === directory.id),
      nextOffset: null,
      sort:
        this.directorySorts.get(directory.id) ??
        DEFAULT_FILESYSTEM_DIRECTORY_SORT,
    };
  }

  async updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort> {
    this.directorySorts.set(directoryId, { ...sort });
    return { ...sort };
  }

  async getDirectoryDetails(
    directoryId: string,
  ): Promise<FilesystemDirectoryDetails> {
    const directory = this.findDirectory(directoryId);
    if (!directory) throw new Error("Directory not found");

    const descendants = this.collectDescendants(directory.id);
    const files = descendants.filter(
      (entry): entry is FilesystemFileEntry =>
        entry.kind === FILESYSTEM_ENTRY_KIND.FILE,
    );

    return {
      directory,
      breadcrumbs: this.buildBreadcrumbs(directory),
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      fileCount: files.length,
      directoryCount: descendants.filter(
        (entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
      ).length,
      widgetCount: descendants.filter(
        (entry) => entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET,
      ).length,
    };
  }

  async createDirectory(parentId: string, name: string): Promise<FilesystemDirectoryEntry> {
    const directory: FilesystemDirectoryEntry = {
      id: `folder-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(directory);
    return directory;
  }

  async uploadFile(parentId: string, file: File): Promise<FilesystemFileEntry> {
    const entry: FilesystemFileEntry = {
      id: `file-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: file.name,
      contentType: file.type,
      size: file.size,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(entry);
    return entry;
  }

  async updateEntry(id: string, input: UpdateFilesystemEntryInput): Promise<FilesystemEntry> {
    const index = this.entries.findIndex((entry) => entry.id === id);
    const entry = this.entries[index];
    if (!entry) throw new Error("Entry not found");
    const updated = {
      ...entry,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    } as FilesystemEntry;
    this.entries[index] = updated;
    return updated;
  }

  async moveEntry(
    id: string,
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    return this.updateEntry(id, { parentId: input.parentId });
  }

  async moveEntries(
    ids: readonly string[],
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemBatchResult> {
    const entries = await Promise.all(
      ids.map((id) => this.moveEntry(id, input)),
    );
    return batchResult(ids, entries);
  }

  async trashEntry(id: string) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    const entry = this.entries[index];
    if (!entry) return { entry: null, closedWidgetIds: [] };
    this.entries.splice(index, 1);
    this.trash.push({
      entry,
      deletedAt: "2026-08-20T00:00:00.000Z",
      deletionStartedAt: null,
      originalParentId: entry.parentId,
      originalLocation: "내 문서",
    });
    return { entry: null, closedWidgetIds: [] };
  }

  async trashEntries(ids: readonly string[]): Promise<FilesystemBatchResult> {
    const closedWidgetIds: string[] = [];
    for (const id of ids) {
      const result = await this.trashEntry(id);
      closedWidgetIds.push(...result.closedWidgetIds);
    }
    return { ...batchResult(ids), closedWidgetIds };
  }

  async createDownloadManifest(
    ids: readonly string[],
  ): Promise<FilesystemDownloadManifest> {
    const selected = this.entries.filter((entry) => ids.includes(entry.id));
    const files = selected.filter(
      (entry): entry is FilesystemFileEntry =>
        entry.kind === FILESYSTEM_ENTRY_KIND.FILE,
    );
    return {
      archiveName: "computer-room-files.zip",
      entries: files.map((entry) => ({
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        id: entry.id,
        path: entry.name,
        size: entry.size,
        updatedAt: entry.updatedAt,
        downloadUrl: this.downloadUrl(entry.id),
      })),
      totalFileCount: files.length,
      totalBytes: files.reduce((total, entry) => total + entry.size, 0),
      skippedWidgetIds: selected
        .filter((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET)
        .map((entry) => entry.id),
    };
  }

  downloadUrl(id: string): string {
    return `${FILESYSTEM_API_PATHS.FILES}/${id}/${API_PATH_SEGMENTS.DOWNLOAD}`;
  }

  contentUrl(id: string): string {
    return `${FILESYSTEM_API_PATHS.FILES}/${id}/${API_PATH_SEGMENTS.CONTENT}`;
  }

  thumbnailUrl(id: string): string {
    return `${FILESYSTEM_API_PATHS.FILES}/${id}/${API_PATH_SEGMENTS.THUMBNAIL}`;
  }

  async listTrash(): Promise<FilesystemTrashPage> {
    return { items: [...this.trash], nextOffset: null };
  }

  async restoreEntry(id: string): Promise<FilesystemEntry> {
    const index = this.trash.findIndex((item) => item.entry.id === id);
    const item = this.trash[index];
    if (!item) throw new Error("Entry not found");
    this.trash.splice(index, 1);
    this.entries.push(item.entry);
    return item.entry;
  }

  async restoreEntries(ids: readonly string[]): Promise<FilesystemBatchResult> {
    const entries = await Promise.all(ids.map((id) => this.restoreEntry(id)));
    return batchResult(ids, entries);
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    const index = this.trash.findIndex((item) => item.entry.id === id);
    if (index >= 0) this.trash.splice(index, 1);
  }

  async permanentlyDeleteEntries(
    ids: readonly string[],
  ): Promise<FilesystemBatchResult> {
    await Promise.all(ids.map((id) => this.permanentlyDeleteEntry(id)));
    return batchResult(ids);
  }

  async emptyTrash(): Promise<void> {
    this.trash.splice(0);
  }

  private findDirectory(id: string): FilesystemDirectoryEntry | null {
    if (id === this.root.id) return this.root;
    if (id === this.desktopRoot.id) return this.desktopRoot;
    return (
      this.entries.find(
        (entry): entry is FilesystemDirectoryEntry =>
          entry.id === id && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
      ) ?? null
    );
  }

  private collectDescendants(directoryId: string): FilesystemEntry[] {
    const children = this.entries.filter(
      (entry) => entry.parentId === directoryId,
    );
    return children.flatMap((entry) =>
      entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
        ? [entry, ...this.collectDescendants(entry.id)]
        : [entry],
    );
  }

  private buildBreadcrumbs(
    directory: FilesystemDirectoryEntry,
  ): FilesystemDirectoryDetails["breadcrumbs"] {
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let current: FilesystemDirectoryEntry | null = directory;
    while (current) {
      breadcrumbs.unshift({ id: current.id, name: current.name });
      current = current.parentId ? this.findDirectory(current.parentId) : null;
    }
    return breadcrumbs;
  }
}

export function batchResult(
  ids: readonly string[],
  entries: readonly FilesystemEntry[] = [],
): FilesystemBatchResult {
  return {
    succeededIds: [...ids],
    entries,
    failures: [],
    closedWidgetIds: [],
  };
}
