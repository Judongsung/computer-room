import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { requireFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import type {
  DesktopPlacement,
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { DirectorySortRepository } from "@/types/filesystem/directory-sort-repository";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type {
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
  FilesystemNameAllocator as FilesystemNameAllocatorPort,
} from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemDirectoryUseCases } from "@/types/filesystem/services/directory-service";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import {
  toPublicDirectory,
  toPublicEntry,
} from "@/application/filesystem/filesystem-entry-mapper";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";

export class FilesystemDirectoryService
  implements FilesystemDirectoryUseCases
{
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly directorySorts: DirectorySortRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(repository),
    private readonly names: FilesystemNameAllocatorPort =
      new FilesystemNameAllocator(repository),
  ) {}

  async listDirectory(
    parentId: string | null,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage> {
    const directory = await this.requireActiveDirectory(
      parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS,
    );
    const sort =
      (await this.directorySorts.find(directory.id)) ??
      DEFAULT_FILESYSTEM_DIRECTORY_SORT;
    const entries = await this.repository.listChildren(
      directory.id,
      offset,
      limit + 1,
      sort,
    );
    const hasMore = entries.length > limit;
    return {
      directory: toPublicDirectory(directory),
      breadcrumbs: await this.repository.listBreadcrumbs(directory.id),
      items: entries.slice(0, limit).map(toPublicEntry),
      nextOffset: hasMore ? offset + limit : null,
      sort,
    };
  }

  async updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort> {
    const validatedSort = requireFilesystemDirectorySort(sort);
    await this.requireActiveDirectory(directoryId);
    await this.directorySorts.save(directoryId, validatedSort);
    return validatedSort;
  }

  async createDirectory(
    parentId: string | null,
    requestedName: string,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemDirectoryEntry> {
    const parent = await this.requireActiveDirectory(
      parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS,
    );
    const name = await this.names.allocate(parent.id, requestedName);
    const createdAt = this.clock.now();
    const desktopOrder = await nextDesktopOrder(
      this.repository,
      parent.id,
      desktopPlacement,
    );
    const directory = {
      id: this.idGenerator.generate(),
      parentId: parent.id,
      name,
      nameKey: filesystemNameKey(name),
      createdAt,
      ...(desktopOrder === undefined ? {} : { desktopOrder }),
    };
    await this.repository.insertDirectory(directory);
    return toPublicDirectory({
      ...emptyRecord(),
      ...directory,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      updatedAt: createdAt,
      desktopOrder: desktopOrder ?? null,
    });
  }

  private async requireActiveDirectory(
    id: string,
  ): Promise<FilesystemEntryRecord> {
    return this.activeEntries.requireDirectory(id, {
      notFound: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    });
  }
}

function emptyRecord(): Omit<
  FilesystemEntryRecord,
  | "id"
  | "parentId"
  | "kind"
  | "name"
  | "nameKey"
  | "createdAt"
  | "updatedAt"
  | "desktopOrder"
> {
  return {
    fileId: null,
    widgetId: null,
    restoreParentId: null,
    restorePath: null,
    trashedAt: null,
    objectKey: null,
    contentType: null,
    size: null,
    etag: null,
    fileStatus: null,
    widgetType: null,
    widgetOpen: null,
  };
}
