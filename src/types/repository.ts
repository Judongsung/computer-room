import type {
  FilesystemBreadcrumb,
  FilesystemEntryRecord,
  FilesystemFileObject,
  NewFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
} from "./filesystem";

export interface FilesystemRepository {
  findEntry(id: string): Promise<FilesystemEntryRecord | null>;
  listChildren(
    parentId: string,
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]>;
  listActiveFiles(
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]>;
  listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]>;
  listNameKeys(parentId: string, excludeId?: string): Promise<string[]>;
  listDesktopEntryIds(): Promise<string[]>;
  isWithinRoot(entryId: string, rootId: string): Promise<boolean>;
  isDescendant(entryId: string, candidateId: string): Promise<boolean>;
  insertDirectory(directory: NewFilesystemDirectory): Promise<void>;
  insertPendingFile(file: NewFilesystemFile): Promise<void>;
  insertWidget(widget: NewFilesystemWidget): Promise<void>;
  findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null>;
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
