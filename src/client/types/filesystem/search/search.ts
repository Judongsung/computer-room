import type { FilesystemSearchQuery } from "@/types/filesystem/search/search";

export interface SearchDirectory {
  readonly id: string;
  readonly name: string;
}

export interface SearchLocation {
  readonly directory: SearchDirectory;
  readonly initialQuery?: FilesystemSearchQuery;
}
