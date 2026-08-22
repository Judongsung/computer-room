import type { FILESYSTEM_ENTRY_KIND } from "../constants/filesystem";
import type { FileStatus } from "./file";
import type { StoredObjectBody } from "./storage";

export type FilesystemEntryKind =
  (typeof FILESYSTEM_ENTRY_KIND)[keyof typeof FILESYSTEM_ENTRY_KIND];

export interface FilesystemDirectoryEntry {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FilesystemFileEntry {
  readonly id: string;
  readonly parentId: string;
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.FILE;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FilesystemEntry = FilesystemDirectoryEntry | FilesystemFileEntry;

export interface FilesystemBreadcrumb {
  readonly id: string;
  readonly name: string;
}

export interface FilesystemDirectoryPage {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly items: readonly FilesystemEntry[];
  readonly nextOffset: number | null;
}

export interface TrashedFilesystemEntry {
  readonly entry: FilesystemEntry;
  readonly deletedAt: string;
  readonly originalLocation: string;
}

export interface FilesystemTrashPage {
  readonly items: readonly TrashedFilesystemEntry[];
  readonly nextOffset: number | null;
}

export interface FilesystemEntryRecord {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: FilesystemEntryKind;
  readonly name: string;
  readonly nameKey: string;
  readonly fileId: string | null;
  readonly restoreParentId: string | null;
  readonly restorePath: string | null;
  readonly trashedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly objectKey: string | null;
  readonly contentType: string | null;
  readonly size: number | null;
  readonly etag: string | null;
  readonly fileStatus: FileStatus | null;
}

export interface NewFilesystemDirectory {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly createdAt: number;
}

export interface NewFilesystemFile {
  readonly entry: NewFilesystemDirectory;
  readonly objectKey: string;
  readonly contentType: string;
  readonly size: number;
}

export interface UploadFilesystemFileInput {
  readonly parentId?: string | null;
  readonly originalName: string;
  readonly contentType: string | null;
  readonly declaredSize: number;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface UpdateFilesystemEntryInput {
  readonly name?: string;
  readonly parentId?: string;
}

export interface FilesystemDownload {
  readonly entry: FilesystemFileEntry;
  readonly object: StoredObjectBody;
}

export interface FilesystemFileObject {
  readonly id: string;
  readonly objectKey: string;
}
