import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { AppError } from "../domain/errors";
import {
  availableFilesystemName,
  filesystemNameKey,
} from "../domain/filesystem-name";
import type {
  FilesystemEntry,
  FilesystemEntryRecord,
  FilesystemTrashPage,
} from "../types/filesystem";
import type { RecycleBinUseCases } from "../types/filesystem-service";
import type { FilesystemRepository } from "../types/repository";
import type { Clock } from "../types/runtime";
import type { FileObjectStorage } from "../types/storage";
import { toPublicEntry } from "./filesystem-service";

export class RecycleBinService implements RecycleBinUseCases {
  constructor(
    private readonly repository: FilesystemRepository,
    private readonly storage: FileObjectStorage,
    private readonly clock: Clock,
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
        originalLocation: entry.restorePath ?? FILESYSTEM_ROOT_NAME.DOCUMENTS,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async restoreEntry(id: string): Promise<FilesystemEntry> {
    const entry = await this.requireTrashRoot(id);
    const parentId = await this.resolveRestoreParent(entry.restoreParentId);
    const occupied = new Set(await this.repository.listNameKeys(parentId));
    const name = availableFilesystemName(entry.name, occupied);
    const updatedAt = this.clock.now();
    await this.repository.restoreEntry(
      entry.id,
      parentId,
      name,
      filesystemNameKey(name),
      updatedAt,
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
    });
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    await this.requireTrashRoot(id);
    const objects = await this.repository.listSubtreeFileObjects(id);
    await this.storage.deleteMany(objects.map((object) => object.objectKey));
    await this.repository.purgeEntry(id);
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
    const parent = await this.repository.findEntry(restoreParentId);
    if (
      parent?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
      (await this.repository.isWithinRoot(
        parent.id,
        FILESYSTEM_ROOT_ID.DOCUMENTS,
      ))
    ) {
      return parent.id;
    }
    return FILESYSTEM_ROOT_ID.DOCUMENTS;
  }
}

function requireDeletedAt(entry: FilesystemEntryRecord): number {
  if (entry.trashedAt === null) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return entry.trashedAt;
}
