import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { GUEST_ACCESS_ERRORS } from "@/constants/admin/errors/guest-access";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import type { GuestAccessRepository } from "@/types/admin/guest-access-repository";
import type { GuestAccessUseCases } from "@/types/admin/guest-access-service";
import type {
  GuestAccessDirectoryPage,
  GuestAccessSettings,
  GuestPublicationMutationResult,
} from "@/types/admin/guest-access";
import type { ActiveFilesystemEntryResolver } from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemDirectoryUseCases } from "@/types/filesystem/services/directory-service";
import type { Clock } from "@/types/platform/runtime";
import type { WidgetType } from "@/types/widgets/widget";

const PUBLISHABLE_WIDGET_TYPES = new Set<WidgetType>([
  WIDGET_TYPE.MEMO,
  WIDGET_TYPE.DAILY_CHECKLIST,
]);

export class GuestAccessService implements GuestAccessUseCases {
  constructor(
    private readonly guestAccess: GuestAccessRepository,
    private readonly directories: Pick<
      FilesystemDirectoryUseCases,
      "listDirectory"
    >,
    private readonly activeEntries: ActiveFilesystemEntryResolver,
    private readonly clock: Clock,
  ) {}

  getSettings(): Promise<GuestAccessSettings> {
    return this.guestAccess.getSettings();
  }

  updateSettings(enabled: boolean): Promise<GuestAccessSettings> {
    return this.guestAccess.saveSettings(enabled);
  }

  async listDirectory(
    directoryId: string,
    offset: number,
    limit: number,
  ): Promise<GuestAccessDirectoryPage> {
    const page = await this.directories.listDirectory(
      directoryId,
      offset,
      limit,
    );
    const states = await this.guestAccess.findPublicationStates(
      page.items.map((item) => item.id),
    );
    return {
      ...page,
      items: page.items.map((entry) => ({
        entry,
        publicationState:
          states.get(entry.id) ?? GUEST_PUBLICATION_STATE.PRIVATE,
      })),
    };
  }

  async setEntryPublished(
    entryId: string,
    published: boolean,
  ): Promise<GuestPublicationMutationResult> {
    if ((FILESYSTEM_SYSTEM_ROOT_IDS as readonly string[]).includes(entryId)) {
      throw new AppError(GUEST_ACCESS_ERRORS.SYSTEM_ROOT_NOT_PUBLISHABLE);
    }
    const entry = await this.activeEntries.requireEntry(entryId, {
      notFound: GUEST_ACCESS_ERRORS.ENTRY_NOT_FOUND,
      inactive: GUEST_ACCESS_ERRORS.ENTRY_NOT_ACTIVE,
    });
    if (
      entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
      (!entry.widgetType || !PUBLISHABLE_WIDGET_TYPES.has(entry.widgetType))
    ) {
      throw new AppError(GUEST_ACCESS_ERRORS.ENTRY_TYPE_NOT_SUPPORTED);
    }
    const recursive = entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY;
    const affectedCount = await this.guestAccess.setEntryPublished(
      entry.id,
      recursive,
      published,
      this.clock.now(),
    );
    return {
      entryId: entry.id,
      publicationState: published
        ? GUEST_PUBLICATION_STATE.PUBLIC
        : GUEST_PUBLICATION_STATE.PRIVATE,
      affectedCount,
    };
  }
}
