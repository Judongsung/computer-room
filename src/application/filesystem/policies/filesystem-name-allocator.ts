import {
  availableFilesystemName,
  normalizeFilesystemName,
} from "@/domain/filesystem/filesystem-name";
import type { FilesystemNameAllocator as FilesystemNameAllocatorPort } from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";

export class FilesystemNameAllocator implements FilesystemNameAllocatorPort {
  constructor(private readonly entries: FilesystemQueryRepository) {}

  async allocate(
    parentId: string,
    requestedName: string,
    excludeId?: string,
  ): Promise<string> {
    const normalizedName = normalizeFilesystemName(requestedName);
    const occupiedNameKeys = new Set(
      await this.entries.listNameKeys(parentId, excludeId),
    );
    return availableFilesystemName(normalizedName, occupiedNameKeys);
  }
}
