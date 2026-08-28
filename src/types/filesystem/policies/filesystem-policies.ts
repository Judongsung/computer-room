import type { FilesystemEntryRecord } from "@/types/filesystem/filesystem";
import type { AppErrorDefinition } from "@/types/platform/error";

export interface ActiveEntryErrorPolicy {
  readonly notFound: AppErrorDefinition;
  readonly inactive: AppErrorDefinition;
}

export interface ActiveFilesystemEntryResolver {
  find(id: string): Promise<FilesystemEntryRecord | null>;
  requireEntry(
    id: string,
    errors: ActiveEntryErrorPolicy,
  ): Promise<FilesystemEntryRecord>;
  requireDirectory(
    id: string,
    errors: ActiveEntryErrorPolicy,
  ): Promise<FilesystemEntryRecord>;
}

export interface FilesystemNameAllocator {
  allocate(
    parentId: string,
    requestedName: string,
    excludeId?: string,
  ): Promise<string>;
}
