import { FILE_STATUS } from "../constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_PATH_SEPARATOR,
  FILESYSTEM_ROOT_ID,
} from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { AppError } from "../domain/errors";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "../domain/filesystem-name";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemEntryRecord,
  UpdateFilesystemEntryInput,
} from "../types/filesystem";
import type { FilesystemUseCases } from "../types/filesystem-service";
import type { FilesystemRepository } from "../types/repository";
import type { Clock, IdGenerator } from "../types/runtime";

export class FilesystemService implements FilesystemUseCases {
  constructor(
    private readonly repository: FilesystemRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listDirectory(
    parentId: string | null,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage> {
    const directory = await this.requireActiveDirectory(
      parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS,
    );
    const entries = await this.repository.listChildren(
      directory.id,
      offset,
      limit + 1,
    );
    const hasMore = entries.length > limit;
    return {
      directory: toPublicDirectory(directory),
      breadcrumbs: await this.repository.listBreadcrumbs(directory.id),
      items: entries.slice(0, limit).map(toPublicEntry),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async createDirectory(
    parentId: string | null,
    requestedName: string,
  ): Promise<FilesystemDirectoryEntry> {
    const parent = await this.requireActiveDirectory(
      parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS,
    );
    const name = await this.resolveAvailableName(parent.id, requestedName);
    const createdAt = this.clock.now();
    const directory = {
      id: this.idGenerator.generate(),
      parentId: parent.id,
      name,
      nameKey: filesystemNameKey(name),
      createdAt,
    };
    await this.repository.insertDirectory(directory);
    return {
      id: directory.id,
      parentId: directory.parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: directory.name,
      createdAt: toIsoString(createdAt),
      updatedAt: toIsoString(createdAt),
    };
  }

  async updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    this.assertMutableEntry(id);
    const entry = await this.requireActiveEntry(id);
    const parentId = input.parentId ?? entry.parentId;
    if (!parentId) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
    await this.requireActiveDirectory(parentId);
    if (
      entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
      (entry.id === parentId ||
        (await this.repository.isDescendant(entry.id, parentId)))
    ) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_CYCLE);
    }
    const name = await this.resolveAvailableName(
      parentId,
      input.name ?? entry.name,
      entry.id,
    );
    const updatedAt = this.clock.now();
    await this.repository.updateEntry(
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
      updatedAt,
    });
  }

  async trashEntry(id: string): Promise<void> {
    this.assertMutableEntry(id);
    const entry = await this.requireActiveEntry(id);
    if (!entry.parentId) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
    const breadcrumbs = await this.repository.listBreadcrumbs(entry.parentId);
    const restorePath = breadcrumbs
      .map((item) => item.name)
      .join(FILESYSTEM_PATH_SEPARATOR);
    await this.repository.moveToTrash(
      entry.id,
      entry.parentId,
      restorePath,
      this.clock.now(),
    );
  }

  private async requireActiveEntry(id: string): Promise<FilesystemEntryRecord> {
    const entry = await this.repository.findEntry(id);
    if (!entry) {
      throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_FOUND);
    }
    if (!(await this.repository.isWithinRoot(id, FILESYSTEM_ROOT_ID.DOCUMENTS))) {
      throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE);
    }
    return entry;
  }

  private async requireActiveDirectory(
    id: string,
  ): Promise<FilesystemEntryRecord> {
    const entry = await this.repository.findEntry(id);
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND);
    }
    if (!(await this.repository.isWithinRoot(id, FILESYSTEM_ROOT_ID.DOCUMENTS))) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
    return entry;
  }

  private async resolveAvailableName(
    parentId: string,
    requestedName: string,
    excludeId?: string,
  ): Promise<string> {
    const normalized = normalizeFilesystemName(requestedName);
    const occupied = new Set(
      await this.repository.listNameKeys(parentId, excludeId),
    );
    return availableFilesystemName(normalized, occupied);
  }

  private assertMutableEntry(id: string): void {
    if (
      id === FILESYSTEM_ROOT_ID.DOCUMENTS ||
      id === FILESYSTEM_ROOT_ID.RECYCLE_BIN
    ) {
      throw new AppError(FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED);
    }
  }
}

export function toPublicEntry(entry: FilesystemEntryRecord): FilesystemEntry {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
    return toPublicDirectory(entry);
  }
  if (
    entry.fileStatus !== FILE_STATUS.READY ||
    entry.contentType === null ||
    entry.size === null ||
    entry.parentId === null
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: entry.id,
    parentId: entry.parentId,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: entry.name,
    contentType: entry.contentType,
    size: entry.size,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
  };
}

function toPublicDirectory(
  entry: FilesystemEntryRecord,
): FilesystemDirectoryEntry {
  return {
    id: entry.id,
    parentId: entry.parentId,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: entry.name,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
  };
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
