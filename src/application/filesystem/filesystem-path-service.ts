import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import {
  filesystemNameKey,
  normalizeFilesystemName,
} from "@/domain/filesystem/filesystem-name";
import type { FilesystemDirectoryEntry } from "@/types/filesystem/filesystem";
import type { FilesystemPathUseCases } from "@/types/filesystem/services/path-service";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type { ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort } from "@/types/filesystem/policies/filesystem-policies";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";

export class FilesystemPathService implements FilesystemPathUseCases {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(repository),
  ) {}

  async ensureDirectory(
    parentId: string,
    requestedName: string,
  ): Promise<FilesystemDirectoryEntry> {
    await this.requireActiveDirectory(parentId);
    const name = normalizeFilesystemName(requestedName);
    const entry = await this.repository.ensureDirectory({
      id: this.idGenerator.generate(),
      parentId,
      name,
      nameKey: filesystemNameKey(name),
      createdAt: this.clock.now(),
    });

    if (entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT);
    }

    const publicEntry = toPublicEntry(entry);
    if (publicEntry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return publicEntry;
  }

  private async requireActiveDirectory(id: string): Promise<void> {
    await this.activeEntries.requireDirectory(id, {
      notFound: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    });
  }
}
