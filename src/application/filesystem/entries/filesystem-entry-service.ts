import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type {
  FilesystemEntry,
  FilesystemEntryRecord,
  MoveFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type {
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
  FilesystemNameAllocator as FilesystemNameAllocatorPort,
} from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemEntryUseCases } from "@/types/filesystem/services/entry-service";
import type { Clock } from "@/types/platform/runtime";
import {
  assertDesktopPlacement,
  nextDesktopOrder,
} from "@/application/filesystem/desktop-placement";
import {
  settleFilesystemOperations,
  uniqueFilesystemIds,
} from "@/application/filesystem/filesystem-batch";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";

export class FilesystemEntryService implements FilesystemEntryUseCases {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly clock: Clock,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(repository),
    private readonly names: FilesystemNameAllocatorPort =
      new FilesystemNameAllocator(repository),
  ) {}

  async updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
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
    if (!parentId) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
    const name = await this.names.allocate(
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
      name,
      nameKey: filesystemNameKey(name),
      updatedAt,
    });
  }

  async moveEntry(
    id: string,
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    this.assertMutableEntry(id);
    const entry = await this.requireActiveEntry(id);
    const target = await this.requireActiveDirectory(input.parentId);
    if (
      entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
      (entry.id === target.id ||
        (await this.repository.isDescendant(entry.id, target.id)))
    ) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_CYCLE);
    }

    const desktopIds = await this.desktopOrderAfterMove(
      entry,
      target.id,
      input,
    );
    const name = await this.names.allocate(target.id, entry.name, entry.id);
    const updatedAt = this.clock.now();
    await this.repository.updateEntry(
      entry.id,
      target.id,
      name,
      filesystemNameKey(name),
      updatedAt,
      desktopIds,
    );
    return toPublicEntry({
      ...entry,
      parentId: target.id,
      name,
      nameKey: filesystemNameKey(name),
      updatedAt,
      desktopOrder:
        target.id === FILESYSTEM_ROOT_ID.DESKTOP
          ? (desktopIds?.indexOf(entry.id) ?? entry.desktopOrder)
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

  private async desktopOrderAfterMove(
    entry: FilesystemEntryRecord,
    targetParentId: string,
    input: MoveFilesystemEntryInput,
  ): Promise<readonly string[] | undefined> {
    const sourceIsDesktop = entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP;
    const targetIsDesktop = targetParentId === FILESYSTEM_ROOT_ID.DESKTOP;
    if (!sourceIsDesktop && !targetIsDesktop) {
      if (input.desktopPlacement) {
        throw new AppError(FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT);
      }
      return undefined;
    }

    const current = await this.repository.listDesktopEntryIds();
    if (!targetIsDesktop) {
      return current.filter((entryId) => entryId !== entry.id);
    }
    if (!sourceIsDesktop) {
      await nextDesktopOrder(
        this.repository,
        targetParentId,
        input.desktopPlacement,
      );
      return [...current, entry.id];
    }
    if (!input.desktopPlacement) {
      return current;
    }
    assertDesktopPlacement(input.desktopPlacement);
    const sourceIndex = current.indexOf(entry.id);
    const targetIndex = Math.min(
      input.desktopPlacement.targetIndex,
      current.length - 1,
    );
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return current;
    }
    const reordered = [...current];
    const targetId = reordered[targetIndex];
    if (!targetId) {
      return current;
    }
    reordered[sourceIndex] = targetId;
    reordered[targetIndex] = entry.id;
    return reordered;
  }

  private async requireActiveEntry(id: string): Promise<FilesystemEntryRecord> {
    this.assertMutableEntry(id);
    return this.activeEntries.requireEntry(id, {
      notFound: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE,
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

  private assertMutableEntry(id: string): void {
    if ((FILESYSTEM_SYSTEM_ROOT_IDS as readonly string[]).includes(id)) {
      throw new AppError(FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED);
    }
  }
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
