import type {
  FilesystemBreadcrumb,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
  FilesystemFileObject,
  NewFilesystemDirectory,
  NewExactFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
  RootedFilesystemEntryRecord,
} from "@/types/filesystem/filesystem";

export interface FilesystemQueryRepository {
  findEntry(id: string): Promise<FilesystemEntryRecord | null>;
  findEntryWithinRoots(
    id: string,
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord | null>;
  findEntriesWithinRoots(
    ids: readonly string[],
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord[]>;
  listActiveSubtrees(
    rootIds: readonly string[],
  ): Promise<RootedFilesystemEntryRecord[]>;
  listChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]>;
  listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]>;
  listNameKeys(parentId: string, excludeId?: string): Promise<string[]>;
  isWithinRoot(entryId: string, rootId: string): Promise<boolean>;
  isDescendant(entryId: string, candidateId: string): Promise<boolean>;
  findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null>;
}

export interface DesktopEntryOrderRepository {
  listDesktopEntryIds(): Promise<string[]>;
  replaceDesktopEntryOrder(entryIds: readonly string[]): Promise<void>;
}

export interface FilesystemMutationRepository {
  insertDirectory(directory: NewFilesystemDirectory): Promise<void>;
  ensureDirectory(
    directory: NewExactFilesystemDirectory,
  ): Promise<FilesystemEntryRecord>;
  insertPendingFile(file: NewFilesystemFile): Promise<void>;
  insertWidget(widget: NewFilesystemWidget): Promise<void>;
  markFileReady(id: string, size: number, etag: string): Promise<void>;
  deleteFileMetadata(id: string): Promise<void>;
  updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<void>;
}

export interface RecycleBinRepository {
  moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<string[]>;
  restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopOrder?: number,
  ): Promise<void>;
  listTrash(offset: number, limit: number): Promise<FilesystemEntryRecord[]>;
  listTrashRootIds(): Promise<string[]>;
  listSubtreeFileObjects(rootId: string): Promise<FilesystemFileObject[]>;
  purgeEntry(rootId: string): Promise<void>;
}

export interface FilesystemRepository
  extends FilesystemQueryRepository,
    DesktopEntryOrderRepository,
    FilesystemMutationRepository,
    RecycleBinRepository {}

export type FileRepository = FilesystemQueryRepository & FilesystemMutationRepository;
export type DirectoryRepository = FilesystemQueryRepository &
  FilesystemMutationRepository &
  DesktopEntryOrderRepository;
export type RecycleBinDataRepository = FilesystemQueryRepository &
  DesktopEntryOrderRepository &
  RecycleBinRepository;
