import { FILE_STATUS } from "../constants/file";
import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_PATH_SEPARATOR,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_SYSTEM_ROOT_IDS,
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
  DesktopPlacement,
  FilesystemEntry,
  FilesystemEntryRecord,
  FilesystemMutationResult,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "../types/filesystem";
import type { FilesystemUseCases } from "../types/filesystem-service";
import type { FilesystemRepository } from "../types/repository";
import type { Clock, IdGenerator } from "../types/runtime";
import { assertDesktopPlacement, nextDesktopOrder } from "./desktop-placement";

export class FilesystemService implements FilesystemUseCases {
  constructor(
    private readonly repository: FilesystemRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listDirectory(parentId: string | null, offset: number, limit: number): Promise<FilesystemDirectoryPage> {
    const directory = await this.requireActiveDirectory(parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS);
    const entries = await this.repository.listChildren(directory.id, offset, limit + 1);
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
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemDirectoryEntry> {
    const parent = await this.requireActiveDirectory(parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS);
    const name = await this.resolveAvailableName(parent.id, requestedName);
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

  async updateEntry(id: string, input: UpdateFilesystemEntryInput): Promise<FilesystemEntry> {
    const entry = await this.requireActiveEntry(id);
    if (input.parentId !== undefined && input.parentId !== entry.parentId) {
      if (input.parentId === FILESYSTEM_ROOT_ID.DESKTOP) {
        throw new AppError(FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT);
      }
      const moved = await this.moveEntry(id, { parentId: input.parentId });
      return input.name === undefined
        ? moved
        : this.updateEntry(id, { name: input.name });
    }
    const parentId = entry.parentId;
    if (!parentId) throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    const name = await this.resolveAvailableName(parentId, input.name ?? entry.name, entry.id);
    const updatedAt = this.clock.now();
    await this.repository.updateEntry(entry.id, parentId, name, filesystemNameKey(name), updatedAt);
    return toPublicEntry({ ...entry, name, nameKey: filesystemNameKey(name), updatedAt });
  }

  async moveEntry(id: string, input: MoveFilesystemEntryInput): Promise<FilesystemEntry> {
    this.assertMutableEntry(id);
    const entry = await this.requireActiveEntry(id);
    const target = await this.requireActiveDirectory(input.parentId);
    if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
        (entry.id === target.id || await this.repository.isDescendant(entry.id, target.id))) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_CYCLE);
    }

    const desktopIds = await this.desktopOrderAfterMove(entry, target.id, input);
    const name = await this.resolveAvailableName(target.id, entry.name, entry.id);
    const updatedAt = this.clock.now();
    await this.repository.updateEntry(entry.id, target.id, name, filesystemNameKey(name),
      updatedAt, desktopIds);
    return toPublicEntry({
      ...entry,
      parentId: target.id,
      name,
      nameKey: filesystemNameKey(name),
      updatedAt,
      desktopOrder: target.id === FILESYSTEM_ROOT_ID.DESKTOP
        ? desktopIds?.indexOf(entry.id) ?? entry.desktopOrder
        : null,
    });
  }

  async trashEntry(id: string): Promise<FilesystemMutationResult> {
    this.assertMutableEntry(id);
    const entry = await this.requireActiveEntry(id);
    if (!entry.parentId) throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    const breadcrumbs = await this.repository.listBreadcrumbs(entry.parentId);
    const restorePath = breadcrumbs.map((item) => item.name).join(FILESYSTEM_PATH_SEPARATOR);
    const desktopIds = entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP
      ? (await this.repository.listDesktopEntryIds()).filter((entryId) => entryId !== entry.id)
      : undefined;
    const closedWidgetIds = await this.repository.moveToTrash(
      entry.id, entry.parentId, restorePath, this.clock.now(), desktopIds,
    );
    return { entry: null, closedWidgetIds };
  }

  private async desktopOrderAfterMove(
    entry: FilesystemEntryRecord,
    targetParentId: string,
    input: MoveFilesystemEntryInput,
  ): Promise<readonly string[] | undefined> {
    const sourceIsDesktop = entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP;
    const targetIsDesktop = targetParentId === FILESYSTEM_ROOT_ID.DESKTOP;
    if (!sourceIsDesktop && !targetIsDesktop) {
      if (input.desktopPlacement) throw new AppError(FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT);
      return undefined;
    }

    const current = await this.repository.listDesktopEntryIds();
    if (!targetIsDesktop) return current.filter((id) => id !== entry.id);
    if (!sourceIsDesktop) {
      await nextDesktopOrder(this.repository, targetParentId, input.desktopPlacement);
      return [...current, entry.id];
    }
    if (!input.desktopPlacement) return current;
    assertDesktopPlacement(input.desktopPlacement);
    const sourceIndex = current.indexOf(entry.id);
    const targetIndex = Math.min(input.desktopPlacement.targetIndex, current.length - 1);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
    const reordered = [...current];
    const targetId = reordered[targetIndex];
    if (!targetId) return current;
    reordered[sourceIndex] = targetId;
    reordered[targetIndex] = entry.id;
    return reordered;
  }

  private async requireActiveEntry(id: string): Promise<FilesystemEntryRecord> {
    this.assertMutableEntry(id);
    const entry = await this.repository.findEntry(id);
    if (!entry) throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_FOUND);
    if (!(await this.isWithinActiveRoot(id))) throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE);
    return entry;
  }

  private async requireActiveDirectory(id: string): Promise<FilesystemEntryRecord> {
    const entry = await this.repository.findEntry(id);
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND);
    }
    if (!(await this.isWithinActiveRoot(id))) throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    return entry;
  }

  private async isWithinActiveRoot(id: string): Promise<boolean> {
    const results = await Promise.all(
      FILESYSTEM_ACTIVE_ROOT_IDS.map((rootId) => this.repository.isWithinRoot(id, rootId)),
    );
    return results.some(Boolean);
  }

  private async resolveAvailableName(parentId: string, requestedName: string, excludeId?: string): Promise<string> {
    const normalized = normalizeFilesystemName(requestedName);
    const occupied = new Set(await this.repository.listNameKeys(parentId, excludeId));
    return availableFilesystemName(normalized, occupied);
  }

  private assertMutableEntry(id: string): void {
    if ((FILESYSTEM_SYSTEM_ROOT_IDS as readonly string[]).includes(id)) {
      throw new AppError(FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED);
    }
  }
}

export function toPublicEntry(entry: FilesystemEntryRecord): FilesystemEntry {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) return toPublicDirectory(entry);
  if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
    if (!entry.widgetId || !entry.widgetType || !entry.parentId) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return {
      id: entry.id, parentId: entry.parentId, kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: entry.name, widgetId: entry.widgetId, widgetType: entry.widgetType,
      createdAt: toIsoString(entry.createdAt), updatedAt: toIsoString(entry.updatedAt),
      desktopOrder: entry.desktopOrder,
    };
  }
  if (entry.fileStatus !== FILE_STATUS.READY || entry.contentType === null ||
      entry.size === null || entry.parentId === null) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: entry.id, parentId: entry.parentId, kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: entry.name, contentType: entry.contentType, size: entry.size,
    createdAt: toIsoString(entry.createdAt), updatedAt: toIsoString(entry.updatedAt),
    desktopOrder: entry.desktopOrder,
  };
}

function toPublicDirectory(entry: FilesystemEntryRecord): FilesystemDirectoryEntry {
  return {
    id: entry.id, parentId: entry.parentId, kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: entry.name, createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt), desktopOrder: entry.desktopOrder,
  };
}

function emptyRecord(): Omit<FilesystemEntryRecord, "id" | "parentId" | "kind" | "name" | "nameKey" | "createdAt" | "updatedAt" | "desktopOrder"> {
  return {
    fileId: null, widgetId: null, restoreParentId: null, restorePath: null,
    trashedAt: null, objectKey: null, contentType: null, size: null, etag: null,
    fileStatus: null, widgetType: null, widgetOpen: null,
  };
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
