import type {
  FilesystemBreadcrumb,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
  FilesystemFileObject,
  NewExactFilesystemDirectory,
  NewFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
  RootedFilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { FilesystemRepository } from "@/types/filesystem/repository";
import { D1DesktopEntryOrderRepository } from "@/infrastructure/filesystem/d1/d1-desktop-entry-order-repository";
import { D1FilesystemMutationRepository } from "@/infrastructure/filesystem/d1/d1-filesystem-mutation-repository";
import { D1FilesystemQueryRepository } from "@/infrastructure/filesystem/d1/d1-filesystem-query-repository";
import { D1RecycleBinRepository } from "@/infrastructure/filesystem/d1/d1-recycle-bin-repository";

export class D1FilesystemRepository implements FilesystemRepository {
  private readonly queries: D1FilesystemQueryRepository;
  private readonly mutations: D1FilesystemMutationRepository;
  private readonly desktopOrder: D1DesktopEntryOrderRepository;
  private readonly recycleBin: D1RecycleBinRepository;

  constructor(database: D1Database) {
    this.queries = new D1FilesystemQueryRepository(database);
    this.mutations = new D1FilesystemMutationRepository(database);
    this.desktopOrder = new D1DesktopEntryOrderRepository(database);
    this.recycleBin = new D1RecycleBinRepository(database);
  }

  findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    return this.queries.findEntry(id);
  }

  findEntryWithinRoots(
    id: string,
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord | null> {
    return this.queries.findEntryWithinRoots(id, rootIds);
  }

  findEntriesWithinRoots(
    ids: readonly string[],
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord[]> {
    return this.queries.findEntriesWithinRoots(ids, rootIds);
  }

  listActiveSubtrees(
    rootIds: readonly string[],
  ): Promise<RootedFilesystemEntryRecord[]> {
    return this.queries.listActiveSubtrees(rootIds);
  }

  findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null> {
    return this.queries.findWidgetEntry(widgetId);
  }

  listChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]> {
    return this.queries.listChildren(parentId, offset, limit, sort);
  }

  listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]> {
    return this.queries.listBreadcrumbs(directoryId);
  }

  listNameKeys(parentId: string, excludeId?: string): Promise<string[]> {
    return this.queries.listNameKeys(parentId, excludeId);
  }

  isWithinRoot(entryId: string, rootId: string): Promise<boolean> {
    return this.queries.isWithinRoot(entryId, rootId);
  }

  isDescendant(entryId: string, candidateId: string): Promise<boolean> {
    return this.queries.isDescendant(entryId, candidateId);
  }

  listDesktopEntryIds(): Promise<string[]> {
    return this.desktopOrder.listDesktopEntryIds();
  }

  replaceDesktopEntryOrder(entryIds: readonly string[]): Promise<void> {
    return this.desktopOrder.replaceDesktopEntryOrder(entryIds);
  }

  insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    return this.mutations.insertDirectory(directory);
  }

  ensureDirectory(
    directory: NewExactFilesystemDirectory,
  ): Promise<FilesystemEntryRecord> {
    return this.mutations.ensureDirectory(directory);
  }

  insertPendingFile(file: NewFilesystemFile): Promise<void> {
    return this.mutations.insertPendingFile(file);
  }

  insertWidget(widget: NewFilesystemWidget): Promise<void> {
    return this.mutations.insertWidget(widget);
  }

  markFileReady(id: string, size: number, etag: string): Promise<void> {
    return this.mutations.markFileReady(id, size, etag);
  }

  deleteFileMetadata(id: string): Promise<void> {
    return this.mutations.deleteFileMetadata(id);
  }

  updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<void> {
    return this.mutations.updateEntry(
      id,
      parentId,
      name,
      nameKey,
      updatedAt,
      desktopEntryIds,
    );
  }

  moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<string[]> {
    return this.recycleBin.moveToTrash(
      id,
      previousParentId,
      restorePath,
      trashedAt,
      desktopEntryIds,
    );
  }

  restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopOrder?: number,
  ): Promise<void> {
    return this.recycleBin.restoreEntry(
      id,
      parentId,
      name,
      nameKey,
      updatedAt,
      desktopOrder,
    );
  }

  listTrash(
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]> {
    return this.recycleBin.listTrash(offset, limit);
  }

  listTrashRootIds(): Promise<string[]> {
    return this.recycleBin.listTrashRootIds();
  }

  listSubtreeFileObjects(rootId: string): Promise<FilesystemFileObject[]> {
    return this.recycleBin.listSubtreeFileObjects(rootId);
  }

  purgeEntry(rootId: string): Promise<void> {
    return this.recycleBin.purgeEntry(rootId);
  }
}
