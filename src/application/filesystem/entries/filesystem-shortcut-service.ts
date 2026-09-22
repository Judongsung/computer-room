import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_SYSTEM_ROOT_IDS } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";
import type { CreateFilesystemShortcutInput, FilesystemEntryRecord, FilesystemShortcutEntry, FilesystemShortcutTarget } from "@/types/filesystem/filesystem";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type { FilesystemShortcutUseCases } from "@/types/filesystem/services/shortcut-service";
import type { Clock, IdGenerator } from "@/types/platform/runtime";

export class FilesystemShortcutService implements FilesystemShortcutUseCases {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly activeEntries = new ActiveFilesystemEntryResolver(repository),
    private readonly names = new FilesystemNameAllocator(repository),
  ) {}

  async createShortcut(input: CreateFilesystemShortcutInput): Promise<FilesystemShortcutEntry> {
    const target = await this.activeEntries.find(input.targetEntryId);
    if (!isSupportedTarget(target)) throw new AppError(FILESYSTEM_ERRORS.INVALID_SHORTCUT_TARGET);
    const parent = await this.activeEntries.requireDirectory(input.parentId, {
      notFound: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    });
    const name = await this.names.allocate(parent.id, input.name);
    const desktopOrder = await nextDesktopOrder(this.repository, parent.id, input.desktopPlacement);
    const createdAt = this.clock.now();
    const id = this.ids.generate();
    await this.repository.insertShortcut({
      id, parentId: parent.id, targetEntryId: target.id, name,
      nameKey: filesystemNameKey(name), createdAt,
      ...(desktopOrder === undefined ? {} : { desktopOrder }),
    });
    return {
      id, parentId: parent.id, kind: FILESYSTEM_ENTRY_KIND.SHORTCUT,
      targetEntryId: target.id, name, createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date(createdAt).toISOString(), desktopOrder: desktopOrder ?? null,
    };
  }

  async resolveShortcut(id: string): Promise<FilesystemShortcutTarget> {
    const shortcut = await this.activeEntries.find(id);
    if (shortcut?.kind !== FILESYSTEM_ENTRY_KIND.SHORTCUT || !shortcut.targetEntryId) {
      throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_FOUND);
    }
    const target = await this.activeEntries.find(shortcut.targetEntryId);
    if (!isSupportedTarget(target)) throw new AppError(FILESYSTEM_ERRORS.SHORTCUT_TARGET_UNAVAILABLE);
    const entry = toPublicEntry(target);
    if (entry.kind === FILESYSTEM_ENTRY_KIND.SHORTCUT) {
      throw new AppError(FILESYSTEM_ERRORS.SHORTCUT_TARGET_UNAVAILABLE);
    }
    return entry;
  }
}

function isSupportedTarget(entry: FilesystemEntryRecord | null): entry is FilesystemEntryRecord {
  if (!entry || entry.trashedAt !== null || entry.deletionStartedAt !== null ||
    (FILESYSTEM_SYSTEM_ROOT_IDS as readonly string[]).includes(entry.id)) return false;
  return entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ||
    (entry.kind === FILESYSTEM_ENTRY_KIND.FILE && entry.fileStatus === FILE_STATUS.READY) ||
    (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
      (entry.widgetType === WIDGET_TYPE.MEMO || entry.widgetType === WIDGET_TYPE.DAILY_CHECKLIST));
}
