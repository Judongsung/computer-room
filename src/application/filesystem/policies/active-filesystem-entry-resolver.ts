import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
} from "@/constants/filesystem/filesystem";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import type {
  ActiveEntryErrorPolicy,
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
} from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemEntryRecord } from "@/types/filesystem/filesystem";

export class ActiveFilesystemEntryResolver
  implements ActiveFilesystemEntryResolverPort
{
  constructor(private readonly entries: FilesystemQueryRepository) {}

  find(id: string): Promise<FilesystemEntryRecord | null> {
    return this.entries.findEntryWithinRoots(id, FILESYSTEM_ACTIVE_ROOT_IDS);
  }

  async requireEntry(
    id: string,
    errors: ActiveEntryErrorPolicy,
  ): Promise<FilesystemEntryRecord> {
    const activeEntry = await this.find(id);
    if (activeEntry) return activeEntry;

    const storedEntry = await this.entries.findEntry(id);
    throw new AppError(storedEntry ? errors.inactive : errors.notFound);
  }

  async requireDirectory(
    id: string,
    errors: ActiveEntryErrorPolicy,
  ): Promise<FilesystemEntryRecord> {
    const activeEntry = await this.find(id);
    if (activeEntry) {
      if (activeEntry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        throw new AppError(errors.notFound);
      }
      return activeEntry;
    }

    const storedEntry = await this.entries.findEntry(id);
    if (!storedEntry || storedEntry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(errors.notFound);
    }
    throw new AppError(errors.inactive);
  }
}
