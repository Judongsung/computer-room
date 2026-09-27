import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import {
  isFilesystemSearchKind,
  isFilesystemSearchMode,
  normalizeSearchQuery,
  validateSearchQuery,
} from "@/domain/filesystem/search/search-query";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";
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
    const mode = query.mode ?? FILESYSTEM_SEARCH_MODE.NAME;
    const q = mode === FILESYSTEM_SEARCH_MODE.NAME ? normalizeSearchQuery(query.q) : validateSearchQuery(query.q);
    if (!isFilesystemSearchKind(query.kind) || !isFilesystemSearchMode(mode)) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_SEARCH);
    }
    if (query.directoryId !== undefined) {
      await this.activeEntries.requireDirectory(query.directoryId, {
        notFound: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND,
        inactive: FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE,
      });
    }
    const records = await this.repository.search({ ...query, q, mode }, offset, limit + 1);
    return {
      items: records.slice(0, limit).map(({ entry, parentPath, contentMatch }) => ({
        entry: toPublicEntry(entry),
        parentPath,
        contentMatch,
      })),
      nextOffset: records.length > limit ? offset + limit : null,
    };
  }
}
