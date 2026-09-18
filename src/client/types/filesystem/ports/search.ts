import type { FilesystemSearchQuery, FilesystemSearchPage } from "@/types/filesystem/search/search";

export interface FilesystemSearchGateway {
  search(query: FilesystemSearchQuery, offset?: number): Promise<FilesystemSearchPage>;
}
