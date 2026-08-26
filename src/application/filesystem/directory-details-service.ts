import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import type {
  DirectoryDetailsRepository,
  DirectoryDetailsUseCases,
  FilesystemDirectoryDetails,
} from "@/types/filesystem/directory-details";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import { toPublicDirectory } from "@/application/filesystem/filesystem-entry-mapper";

export class DirectoryDetailsService implements DirectoryDetailsUseCases {
  constructor(
    private readonly entries: FilesystemQueryRepository,
    private readonly details: DirectoryDetailsRepository,
  ) {}

  async getDetails(directoryId: string): Promise<FilesystemDirectoryDetails> {
    const directory = await this.entries.findEntryWithinRoots(
      directoryId,
      FILESYSTEM_ACTIVE_ROOT_IDS,
    );
    if (!directory || directory.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND);
    }

    const [breadcrumbs, statistics] = await Promise.all([
      this.entries.listBreadcrumbs(directory.id),
      this.details.readStatistics(directory.id),
    ]);
    return {
      directory: toPublicDirectory(directory),
      breadcrumbs,
      ...statistics,
    };
  }
}
