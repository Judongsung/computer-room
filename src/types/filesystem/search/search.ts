import type { FilesystemEntry, FilesystemEntryRecord } from "@/types/filesystem/filesystem";
import type { FILESYSTEM_SEARCH_KIND, FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";

export type FilesystemSearchKind = (typeof FILESYSTEM_SEARCH_KIND)[keyof typeof FILESYSTEM_SEARCH_KIND];
export type FilesystemSearchMode = (typeof FILESYSTEM_SEARCH_MODE)[keyof typeof FILESYSTEM_SEARCH_MODE];

export interface FilesystemSearchQuery {
  readonly q: string;
  readonly kind: FilesystemSearchKind;
  readonly mode?: FilesystemSearchMode;
  readonly directoryId?: string;
}

export interface FilesystemSearchItem {
  readonly entry: FilesystemEntry;
  readonly parentPath: string;
  readonly contentMatch: { readonly excerpt: string } | null;
}

export interface FilesystemSearchPage {
  readonly items: readonly FilesystemSearchItem[];
  readonly nextOffset: number | null;
}

export interface FilesystemSearchRepository {
  search(query: FilesystemSearchQuery, offset: number, limit: number): Promise<readonly {
    readonly entry: FilesystemEntryRecord;
    readonly parentPath: string;
    readonly contentMatch: FilesystemSearchItem["contentMatch"];
  }[]>;
}

export interface FilesystemSearchUseCases {
  search(query: FilesystemSearchQuery, offset: number, limit: number): Promise<FilesystemSearchPage>;
}
