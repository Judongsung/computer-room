import type { FilesystemEntry, FilesystemEntryRecord } from "@/types/filesystem/filesystem";
import type { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";

export type FilesystemSearchKind = (typeof FILESYSTEM_SEARCH_KIND)[keyof typeof FILESYSTEM_SEARCH_KIND];

export interface FilesystemSearchQuery {
  readonly q: string;
  readonly kind: FilesystemSearchKind;
  readonly directoryId?: string;
}

export interface FilesystemSearchItem {
  readonly entry: FilesystemEntry;
  readonly parentPath: string;
}

export interface FilesystemSearchPage {
  readonly items: readonly FilesystemSearchItem[];
  readonly nextOffset: number | null;
}

export interface FilesystemSearchRepository {
  search(query: FilesystemSearchQuery, offset: number, limit: number): Promise<readonly {
    readonly entry: FilesystemEntryRecord;
    readonly parentPath: string;
  }[]>;
}

export interface FilesystemSearchUseCases {
  search(query: FilesystemSearchQuery, offset: number, limit: number): Promise<FilesystemSearchPage>;
}
