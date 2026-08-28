import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { thumbnailObjectKeys } from "@/domain/filesystem/thumbnail";
import type {
  FilesystemEntry,
  FilesystemEntryRecord,
  FilesystemTrashPage,
  RestoreFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { RecycleBinUseCases } from "@/types/filesystem/filesystem-service";
import type { RecycleBinDataRepository } from "@/types/filesystem/repository";
import type { Clock } from "@/types/platform/runtime";
import type { FileObjectStorage } from "@/types/filesystem/storage";
import type {
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
  FilesystemNameAllocator as FilesystemNameAllocatorPort,
} from "@/types/filesystem/policies/filesystem-policies";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import { settleFilesystemOperations } from "@/application/filesystem/filesystem-batch";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";

export class RecycleBinService implements RecycleBinUseCases {
  constructor(
    private readonly repository: RecycleBinDataRepository,
    private readonly storage: FileObjectStorage,
    private readonly clock: Clock,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(repository),
    private readonly names: FilesystemNameAllocatorPort =
      new FilesystemNameAllocator(repository),
  ) {}

  async listTrash(
    offset: number,
    limit: number,
  ): Promise<FilesystemTrashPage> {
    const entries = await this.repository.listTrash(offset, limit + 1);
    const hasMore = entries.length > limit;
    return {
      items: entries.slice(0, limit).map((entry) => ({
        entry: toPublicEntry(entry),
        deletedAt: new Date(requireDeletedAt(entry)).toISOString(),
        originalParentId: entry.restoreParentId,
        originalLocation: entry.restorePath ?? FILESYSTEM_ROOT_NAME.DOCUMENTS,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async restoreEntry(
    id: string,
    input: RestoreFilesystemEntryInput = {},
  ): Promise<FilesystemEntry> {
    const entry = await this.requireTrashRoot(id);
    const parentId = input.parentId
      ? await this.requireRestoreDestination(input.parentId)
      : await this.resolveRestoreParent(entry.restoreParentId);
    const name = await this.names.allocate(parentId, entry.name);
    const updatedAt = this.clock.now();
    const desktopOrder = await nextDesktopOrder(
      this.repository,
      parentId,
      input.desktopPlacement,
    );
    await this.repository.restoreEntry(
      entry.id,
      parentId,
      name,
      filesystemNameKey(name),
      updatedAt,
      desktopOrder,
    );
    return toPublicEntry({
      ...entry,
      parentId,
      name,
      nameKey: filesystemNameKey(name),
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      updatedAt,
      desktopOrder: desktopOrder ?? null,
    });
  }

  async restoreEntries(
    ids: readonly string[],
    input: RestoreFilesystemEntryInput = {},
  ): Promise<FilesystemBatchResult> {
    const settled = await settleFilesystemOperations(ids, async (id) => {
      const entry = await this.requireTrashRoot(id);
      const targetsDesktop =
        input.parentId === FILESYSTEM_ROOT_ID.DESKTOP ||
        (input.parentId === undefined &&
          entry.restoreParentId === FILESYSTEM_ROOT_ID.DESKTOP);
      return this.restoreEntry(id, {
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(targetsDesktop && input.desktopPlacement
          ? { desktopPlacement: input.desktopPlacement }
          : {}),
      });
    });
    return {
      succeededIds: settled.succeeded.map(({ id }) => id),
      entries: settled.succeeded.map(({ value }) => value),
      failures: settled.failures,
      closedWidgetIds: [],
    };
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    await this.requireTrashRoot(id);
    const objects = await this.repository.listSubtreeFileObjects(id);
    await this.storage.deleteMany(
      objects.flatMap((object) => [
        object.objectKey,
        ...thumbnailObjectKeys(object.id),
      ]),
    );
    await this.repository.purgeEntry(id);
  }

  async permanentlyDeleteEntries(
    ids: readonly string[],
  ): Promise<FilesystemBatchResult> {
    const settled = await settleFilesystemOperations(ids, (id) =>
      this.permanentlyDeleteEntry(id),
    );
    return {
      succeededIds: settled.succeeded.map(({ id }) => id),
      entries: [],
      failures: settled.failures,
      closedWidgetIds: [],
    };
  }

  async emptyTrash(): Promise<void> {
    const rootIds = await this.repository.listTrashRootIds();
    for (const id of rootIds) {
      await this.permanentlyDeleteEntry(id);
    }
  }

  private async requireTrashRoot(id: string): Promise<FilesystemEntryRecord> {
    const entry = await this.repository.findEntry(id);
    if (
      !entry ||
      entry.parentId !== FILESYSTEM_ROOT_ID.RECYCLE_BIN ||
      entry.trashedAt === null
    ) {
      throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_TRASHED);
    }
    return entry;
  }

  private async resolveRestoreParent(
    restoreParentId: string | null,
  ): Promise<string> {
    if (!restoreParentId) {
      return FILESYSTEM_ROOT_ID.DOCUMENTS;
    }
    const parent = await this.activeEntries.find(restoreParentId);
    if (parent?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      return parent.id;
    }
    return FILESYSTEM_ROOT_ID.DOCUMENTS;
  }

  private async requireRestoreDestination(id: string): Promise<string> {
    const entry = await this.activeEntries.requireDirectory(id, {
      notFound: FILESYSTEM_ERRORS.INVALID_PARENT,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    });
    return entry.id;
  }
}

function requireDeletedAt(entry: FilesystemEntryRecord): number {
  if (entry.trashedAt === null) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return entry.trashedAt;
}
