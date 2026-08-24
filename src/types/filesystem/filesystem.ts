import type { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import type { FileStatus } from "@/types/filesystem/file";
import type { StoredObjectBody } from "@/types/filesystem/storage";
import type { ByteRange } from "@/types/filesystem/media";
import type { WidgetType } from "@/types/widgets/widget";

export type FilesystemEntryKind =
  (typeof FILESYSTEM_ENTRY_KIND)[keyof typeof FILESYSTEM_ENTRY_KIND];

export type FilesystemSortField =
  (typeof FILESYSTEM_SORT_FIELD)[keyof typeof FILESYSTEM_SORT_FIELD];

export type FilesystemSortDirection =
  (typeof FILESYSTEM_SORT_DIRECTION)[keyof typeof FILESYSTEM_SORT_DIRECTION];

export interface FilesystemDirectorySort {
  readonly field: FilesystemSortField;
  readonly direction: FilesystemSortDirection;
}

export interface FilesystemDirectoryEntry {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly desktopOrder: number | null;
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
  readonly desktopOrder: number | null;
}

export interface FilesystemWidgetEntry {
  readonly id: string;
  readonly parentId: string;
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.WIDGET;
  readonly name: string;
  readonly widgetId: string;
  readonly widgetType: WidgetType;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly desktopOrder: number | null;
}

export type FilesystemEntry =
  | FilesystemDirectoryEntry
  | FilesystemFileEntry
  | FilesystemWidgetEntry;

export interface FilesystemBreadcrumb {
  readonly id: string;
  readonly name: string;
}

export interface FilesystemDirectoryPage {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly items: readonly FilesystemEntry[];
  readonly nextOffset: number | null;
  readonly sort: FilesystemDirectorySort;
}

export interface TrashedFilesystemEntry {
  readonly entry: FilesystemEntry;
  readonly deletedAt: string;
  readonly originalParentId: string | null;
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
  readonly widgetId: string | null;
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
  readonly widgetType: WidgetType | null;
  readonly widgetOpen: boolean | null;
  readonly desktopOrder: number | null;
}

export interface NewFilesystemDirectory {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly createdAt: number;
  readonly desktopOrder?: number;
}

export type NewExactFilesystemDirectory = Omit<
  NewFilesystemDirectory,
  "desktopOrder"
>;

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
  readonly desktopPlacement?: DesktopPlacement;
}

export interface UpdateFilesystemEntryInput {
  readonly name?: string;
  readonly parentId?: string;
}

export interface DesktopPlacement {
  readonly targetIndex: number;
  readonly capacity: number;
}

export interface MoveFilesystemEntryInput {
  readonly parentId: string;
  readonly desktopPlacement?: DesktopPlacement;
}

export interface RestoreFilesystemEntryInput {
  readonly parentId?: string;
  readonly desktopPlacement?: DesktopPlacement;
}

export interface FilesystemMutationResult {
  readonly entry: FilesystemEntry | null;
  readonly closedWidgetIds: readonly string[];
}

export interface SaveWidgetFileInput {
  readonly parentId: string;
  readonly name: string;
  readonly desktopPlacement?: DesktopPlacement;
}

export interface NewFilesystemWidget {
  readonly id: string;
  readonly widgetId: string;
  readonly widgetType: WidgetType;
  readonly parentId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly createdAt: number;
  readonly desktopOrder?: number;
}

export interface FilesystemDownload {
  readonly entry: FilesystemFileEntry;
  readonly object: StoredObjectBody;
}

export interface FilesystemContent extends FilesystemDownload {
  readonly range: ByteRange | null;
}

export interface FilesystemFileObject {
  readonly id: string;
  readonly objectKey: string;
}

export interface RootedFilesystemEntryRecord {
  readonly rootId: string;
  readonly entry: FilesystemEntryRecord;
}
