import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_PATH_SEPARATOR,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { AppError } from "@/domain/shared/errors";
import { requireFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "@/domain/filesystem/filesystem-name";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  DesktopPlacement,
  FilesystemEntry,
  FilesystemEntryRecord,
  FilesystemMutationResult,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemUseCases } from "@/types/filesystem/filesystem-service";
import type { DirectorySortRepository } from "@/types/filesystem/directory-sort-repository";
import type { DirectoryRepository, RecycleBinRepository } from "@/types/filesystem/repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import { assertDesktopPlacement, nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import {
  settleFilesystemOperations,
  uniqueFilesystemIds,
} from "@/application/filesystem/filesystem-batch";
import {
  toPublicDirectory,
  toPublicEntry,
} from "@/application/filesystem/filesystem-entry-mapper";

export class FilesystemService implements FilesystemUseCases {
  constructor(
    private readonly repository: DirectoryRepository & RecycleBinRepository,
    private readonly directorySorts: DirectorySortRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listDirectory(parentId: string | null, offset: number, limit: number): Promise<FilesystemDirectoryPage> {
    const directory = await this.requireActiveDirectory(parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS);
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

  async moveEntries(
    ids: readonly string[],
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemBatchResult> {
    await this.requireActiveDirectory(input.parentId);
    const uniqueIds = uniqueFilesystemIds(ids);
    const desktopReorderIds: string[] = [];
    const settled = await settleFilesystemOperations(
      uniqueIds,
      async (id): Promise<FilesystemEntry> => {
        const entry = await this.requireActiveEntry(id);
        if (
          entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP &&
          input.parentId === FILESYSTEM_ROOT_ID.DESKTOP
        ) {
          desktopReorderIds.push(id);
          return toPublicEntry(entry);
        }
        return this.moveEntry(id, input);
      },
    );

    let entries = settled.succeeded.map(({ value }) => value);
    if (desktopReorderIds.length > 0 && input.desktopPlacement) {
      assertDesktopPlacement(input.desktopPlacement);
      const currentOrder = await this.repository.listDesktopEntryIds();
      const nextOrder = moveDesktopGroup(
        currentOrder,
        desktopReorderIds,
        input.desktopPlacement.targetIndex,
      );
      await this.repository.replaceDesktopEntryOrder(nextOrder);
      entries = entries.map((entry) =>
        entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? { ...entry, desktopOrder: nextOrder.indexOf(entry.id) }
          : entry,
      );
    }

    return {
      succeededIds: settled.succeeded.map(({ id }) => id),
      entries,
      failures: settled.failures,
      closedWidgetIds: [],
    };
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

  async trashEntries(ids: readonly string[]): Promise<FilesystemBatchResult> {
    const settled = await settleFilesystemOperations(ids, (id) =>
      this.trashEntry(id),
    );
    return {
      succeededIds: settled.succeeded.map(({ id }) => id),
      entries: [],
      failures: settled.failures,
      closedWidgetIds: [
        ...new Set(
          settled.succeeded.flatMap(({ value }) => value.closedWidgetIds),
        ),
      ],
    };
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

function emptyRecord(): Omit<FilesystemEntryRecord, "id" | "parentId" | "kind" | "name" | "nameKey" | "createdAt" | "updatedAt" | "desktopOrder"> {
  return {
    fileId: null, widgetId: null, restoreParentId: null, restorePath: null,
    trashedAt: null, objectKey: null, contentType: null, size: null, etag: null,
    fileStatus: null, widgetType: null, widgetOpen: null,
  };
}

function moveDesktopGroup(
  currentOrder: readonly string[],
  selectedIds: readonly string[],
  targetIndex: number,
): string[] {
  const selected = new Set(selectedIds);
  const orderedSelection = currentOrder.filter((id) => selected.has(id));
  const remaining = currentOrder.filter((id) => !selected.has(id));
  const insertionIndex = Math.min(targetIndex, remaining.length);
  return [
    ...remaining.slice(0, insertionIndex),
    ...orderedSelection,
    ...remaining.slice(insertionIndex),
  ];
}
