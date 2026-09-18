import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import {
  isFilesystemSearchKind,
  normalizeSearchQuery,
} from "@/domain/filesystem/search/search-query";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import type { ActiveFilesystemEntryResolver } from "@/types/filesystem/policies/filesystem-policies";
import type {
  FilesystemSearchPage,
  FilesystemSearchQuery,
  FilesystemSearchRepository,
  FilesystemSearchUseCases,
} from "@/types/filesystem/search/search";

export class FilesystemSearchService implements FilesystemSearchUseCases {
  constructor(
    private readonly repository: FilesystemSearchRepository,
    private readonly activeEntries: ActiveFilesystemEntryResolver,
  ) {}

  async search(
    query: FilesystemSearchQuery,
    offset: number,
    limit: number,
  ): Promise<FilesystemSearchPage> {
    const q = normalizeSearchQuery(query.q);
    if (!isFilesystemSearchKind(query.kind)) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_SEARCH);
    }
    if (query.directoryId !== undefined) {
      await this.activeEntries.requireDirectory(query.directoryId, {
        notFound: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND,
        inactive: FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE,
      });
    }
    const records = await this.repository.search({ ...query, q }, offset, limit + 1);
    return {
      items: records.slice(0, limit).map(({ entry, parentPath }) => ({
        entry: toPublicEntry(entry),
        parentPath,
      })),
      nextOffset: records.length > limit ? offset + limit : null,
    };
  }
}
