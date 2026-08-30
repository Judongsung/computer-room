import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID, FILESYSTEM_ROOT_NAME } from "@/constants/filesystem/filesystem";
import { compareFilesystemEntries } from "@/domain/filesystem/filesystem-sort";
import type { DirectorySortRepository } from "@/types/filesystem/directory-sort-repository";
import type { FilesystemBreadcrumb, FilesystemDirectorySort, FilesystemEntryRecord, FilesystemFileObject, NewFilesystemDirectory, NewExactFilesystemDirectory, NewFilesystemFile, NewFilesystemWidget, RootedFilesystemEntryRecord } from "@/types/filesystem/filesystem";
import type { FilesystemRepository } from "@/types/filesystem/repository";

export class MemoryDirectorySortRepository implements DirectorySortRepository {
  readonly sorts = new Map<string, FilesystemDirectorySort>();

  async find(directoryId: string): Promise<FilesystemDirectorySort | null> {
    const sort = this.sorts.get(directoryId);
    return sort ? { ...sort } : null;
  }

  async save(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<void> {
    this.sorts.set(directoryId, { ...sort });
  }
}

export class MemoryFileRepository implements FilesystemRepository {
  readonly records = new Map<string, FilesystemEntryRecord>();
  failOnDeleteFileMetadata = false;

  constructor() {
    this.seedRoot(FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_NAME.DESKTOP);
    this.seedRoot(FILESYSTEM_ROOT_ID.DOCUMENTS, FILESYSTEM_ROOT_NAME.DOCUMENTS);
    this.seedRoot(FILESYSTEM_ROOT_ID.RECYCLE_BIN, FILESYSTEM_ROOT_NAME.RECYCLE_BIN);
  }

  async findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    return cloneEntry(this.records.get(id) ?? null);
  }

  async findEntryWithinRoots(
    id: string,
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord | null> {
    for (const rootId of rootIds) {
      if (await this.isWithinRoot(id, rootId)) {
        return cloneEntry(this.records.get(id) ?? null);
      }
    }
    return null;
  }

  async findEntriesWithinRoots(
    ids: readonly string[],
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord[]> {
    const entries = await Promise.all(
      [...new Set(ids)].map((id) => this.findEntryWithinRoots(id, rootIds)),
    );
    return entries.filter(
      (entry): entry is FilesystemEntryRecord => entry !== null,
    );
  }

  async listActiveSubtrees(
    rootIds: readonly string[],
  ): Promise<RootedFilesystemEntryRecord[]> {
    return [...new Set(rootIds)].flatMap((rootId) => {
      if (!this.isInActiveRoot(rootId)) return [];
      return this.subtree(rootId).map((entry) => ({
        rootId,
        entry: structuredClone(entry),
      }));
    });
  }

  async listChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === parentId &&
          entry.trashedAt === null &&
          (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
            entry.fileStatus === FILE_STATUS.READY),
      )
      .sort((left, right) => compareFilesystemEntries(left, right, sort))
      .slice(offset, offset + limit)
      .map((entry) => structuredClone(entry));
  }

  async listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]> {
    const result: FilesystemBreadcrumb[] = [];
    let current = this.records.get(directoryId);
    while (current) {
      if (current.id !== FILESYSTEM_ROOT_ID.RECYCLE_BIN) {
        result.unshift({ id: current.id, name: current.name });
      }
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return result;
  }

  async listNameKeys(parentId: string, excludeId?: string): Promise<string[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === parentId &&
          entry.trashedAt === null &&
          entry.id !== excludeId,
      )
      .map((entry) => entry.nameKey);
  }

  async listDesktopEntryIds(): Promise<string[]> {
    return [...this.records.values()]
      .filter((entry) => entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP)
      .sort(
        (left, right) =>
          (left.desktopOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.desktopOrder ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => entry.id);
  }

  async replaceDesktopEntryOrder(entryIds: readonly string[]): Promise<void> {
    this.applyDesktopOrder(entryIds);
  }

  async isWithinRoot(entryId: string, rootId: string): Promise<boolean> {
    let current = this.records.get(entryId);
    while (current) {
      if (current.id === rootId) return true;
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return false;
  }

  async isDescendant(entryId: string, candidateId: string): Promise<boolean> {
    let current = this.records.get(candidateId);
    while (current?.parentId) {
      if (current.parentId === entryId) return true;
      current = this.records.get(current.parentId);
    }
    return false;
  }

  async insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    this.records.set(directory.id, {
      id: directory.id,
      parentId: directory.parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: directory.name,
      nameKey: directory.nameKey,
      fileId: null,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: directory.createdAt,
      updatedAt: directory.createdAt,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: directory.desktopOrder ?? null,
    });
  }

  async ensureDirectory(
    directory: NewExactFilesystemDirectory,
  ): Promise<FilesystemEntryRecord> {
    const existing = [...this.records.values()].find(
      (entry) =>
        entry.parentId === directory.parentId &&
        entry.nameKey === directory.nameKey &&
        entry.trashedAt === null,
    );
    if (existing) {
      return structuredClone(existing);
    }
    if (this.records.has(directory.id)) {
      throw new Error("Duplicate entry ID");
    }

    const desktopOrder =
      directory.parentId === FILESYSTEM_ROOT_ID.DESKTOP
        ? [...this.records.values()].filter(
            (entry) =>
              entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP &&
              entry.trashedAt === null,
          ).length
        : undefined;
    await this.insertDirectory({
      ...directory,
      ...(desktopOrder === undefined ? {} : { desktopOrder }),
    });
    return structuredClone(this.requireEntry(directory.id));
  }

  async insertPendingFile(file: NewFilesystemFile): Promise<void> {
    this.records.set(file.entry.id, {
      id: file.entry.id,
      parentId: file.entry.parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: file.entry.name,
      nameKey: file.entry.nameKey,
      fileId: file.entry.id,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: file.entry.createdAt,
      updatedAt: file.entry.createdAt,
      objectKey: file.objectKey,
      contentType: file.contentType,
      size: file.size,
      etag: null,
      fileStatus: FILE_STATUS.PENDING,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: file.entry.desktopOrder ?? null,
    });
  }

  async insertWidget(widget: NewFilesystemWidget): Promise<void> {
    this.records.set(widget.id, {
      id: widget.id,
      parentId: widget.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: widget.name,
      nameKey: widget.nameKey,
      fileId: null,
      widgetId: widget.widgetId,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: widget.createdAt,
      updatedAt: widget.createdAt,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: widget.widgetType,
      widgetOpen: true,
      desktopOrder: widget.desktopOrder ?? null,
    });
  }

  async findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null> {
    return cloneEntry(
      [...this.records.values()].find((entry) => entry.widgetId === widgetId) ??
        null,
    );
  }

  async markFileReady(id: string, size: number, etag: string): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, { ...entry, size, etag, fileStatus: FILE_STATUS.READY });
  }

  async deleteFileMetadata(id: string): Promise<void> {
    if (this.failOnDeleteFileMetadata) {
      throw new Error("File metadata delete failure");
    }
    this.records.delete(id);
  }

  async updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId,
      name,
      nameKey,
      updatedAt,
      desktopOrder:
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? (desktopEntryIds?.indexOf(id) ?? entry.desktopOrder)
          : null,
    });
    if (desktopEntryIds) this.applyDesktopOrder(desktopEntryIds);
  }

  async moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<string[]> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      restoreParentId: previousParentId,
      restorePath,
      trashedAt,
      updatedAt: trashedAt,
      desktopOrder: null,
    });
    if (desktopEntryIds) this.applyDesktopOrder(desktopEntryIds);
    return this.subtree(id)
      .flatMap((candidate) => (candidate.widgetId ? [candidate.widgetId] : []));
  }

  async restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopOrder?: number,
  ): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId,
      name,
      nameKey,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      updatedAt,
      desktopOrder: desktopOrder ?? null,
    });
  }

  async listTrash(offset: number, limit: number): Promise<FilesystemEntryRecord[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === FILESYSTEM_ROOT_ID.RECYCLE_BIN &&
          entry.trashedAt !== null,
      )
      .sort((left, right) => (right.trashedAt ?? 0) - (left.trashedAt ?? 0))
      .slice(offset, offset + limit)
      .map((entry) => structuredClone(entry));
  }

  async listTrashRootIds(): Promise<string[]> {
    return (await this.listTrash(0, Number.MAX_SAFE_INTEGER)).map((entry) => entry.id);
  }

  async listSubtreeFileObjects(rootId: string): Promise<FilesystemFileObject[]> {
    return this.subtree(rootId)
      .filter((entry) => entry.fileId && entry.objectKey)
      .map((entry) => ({ id: entry.fileId!, objectKey: entry.objectKey! }));
  }

  async purgeEntry(rootId: string): Promise<void> {
    for (const entry of this.subtree(rootId)) {
      this.records.delete(entry.id);
    }
  }

  private seedRoot(id: string, name: string): void {
    this.records.set(id, {
      id,
      parentId: null,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name,
      nameKey: name,
      fileId: null,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: 0,
      updatedAt: 0,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: null,
    });
  }

  private requireEntry(id: string): FilesystemEntryRecord {
    const entry = this.records.get(id);
    if (!entry) throw new Error("Entry not found");
    return entry;
  }

  private isInActiveRoot(id: string): boolean {
    let current = this.records.get(id);
    while (current) {
      if (
        current.id === FILESYSTEM_ROOT_ID.DOCUMENTS ||
        current.id === FILESYSTEM_ROOT_ID.DESKTOP
      ) return true;
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return false;
  }

  private subtree(rootId: string): FilesystemEntryRecord[] {
    const result: FilesystemEntryRecord[] = [];
    const pending = [rootId];
    while (pending.length > 0) {
      const id = pending.pop()!;
      const entry = this.records.get(id);
      if (!entry) continue;
      result.push(entry);
      for (const child of this.records.values()) {
        if (child.parentId === id) pending.push(child.id);
      }
    }
    return result;
  }

  private applyDesktopOrder(ids: readonly string[]): void {
    ids.forEach((id, desktopOrder) => {
      const entry = this.records.get(id);
      if (entry) this.records.set(id, { ...entry, desktopOrder });
    });
  }
}

function cloneEntry(entry: FilesystemEntryRecord | null): FilesystemEntryRecord | null {
  return entry ? structuredClone(entry) : null;
}
