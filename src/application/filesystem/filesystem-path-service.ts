import { FILESYSTEM_ACTIVE_ROOT_IDS, FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import {
  filesystemNameKey,
  normalizeFilesystemName,
} from "@/domain/filesystem/filesystem-name";
import type { FilesystemDirectoryEntry } from "@/types/filesystem/filesystem";
import type { FilesystemPathUseCases } from "@/types/filesystem/filesystem-service";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";

export class FilesystemPathService implements FilesystemPathUseCases {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
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
    const entry = await this.repository.findEntry(id);
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND);
    }
    const activeRootMatches = await Promise.all(
      FILESYSTEM_ACTIVE_ROOT_IDS.map((rootId) =>
        this.repository.isWithinRoot(id, rootId),
      ),
    );
    if (!activeRootMatches.some(Boolean)) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
  }
}
