import { toChecklistData } from "@/application/widgets/checklist-data-mapper";
import { assembleFilesystemDirectoryPage } from "@/application/filesystem/directory/filesystem-directory-page";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { ACCESS_LOGIN_PATH } from "@/constants/platform/auth";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import type { DirectorySortRepository } from "@/types/filesystem/directory-sort-repository";
import type {
  FilesystemContent,
  FilesystemDirectoryPage,
  FilesystemDownload,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type { RequestedByteRange } from "@/types/filesystem/media";
import type { StoredObjectBody } from "@/types/filesystem/storage";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import type { GuestPublicationRepository } from "@/types/guest/guest-repository";
import type { GuestUseCases } from "@/types/guest/guest-service";
import type {
  GuestProgramDocument,
  GuestSessionInfo,
} from "@/types/guest/guest";
import type { Clock } from "@/types/platform/runtime";

export class GuestService implements GuestUseCases {
  constructor(
    private readonly publications: GuestPublicationRepository,
    private readonly directorySorts: DirectorySortRepository,
    private readonly files: Pick<
      FileTransferUseCases,
      "downloadFile" | "streamFile"
    >,
    private readonly thumbnails: ThumbnailUseCases,
    private readonly clock: Clock,
  ) {}

  async getSession(): Promise<GuestSessionInfo> {
    return {
      enabled: await this.publications.isGuestAccessEnabled(),
      loginUrl: ACCESS_LOGIN_PATH,
    };
  }

  async listDirectory(
    directoryId: string,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage> {
    await this.requireEnabled();
    const directory = await this.publications.findVisibleDirectory(directoryId);
    if (!directory) throw this.notFound();
    const sort =
      (await this.directorySorts.find(directory.id)) ??
      DEFAULT_FILESYSTEM_DIRECTORY_SORT;
    const [entries, breadcrumbs] = await Promise.all([
      this.publications.listVisibleChildren(
        directory.id,
        offset,
        limit + 1,
        sort,
      ),
      this.publications.listBreadcrumbs(directory.id),
    ]);
    return assembleFilesystemDirectoryPage({
      directory,
      breadcrumbs,
      entries,
      offset,
      limit,
      sort,
    });
  }

  async downloadFile(id: string): Promise<FilesystemDownload> {
    await this.requirePublishedFile(id);
    return this.files.downloadFile(id);
  }

  async streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent> {
    await this.requirePublishedFile(id);
    return this.files.streamFile(id, requestedRange);
  }

  async getThumbnail(id: string): Promise<StoredObjectBody> {
    await this.requirePublishedFile(id);
    return this.thumbnails.getThumbnail(id);
  }

  async getProgramDocument(id: string): Promise<GuestProgramDocument> {
    await this.requireEnabled();
    const record = await this.publications.findPublishedEntry(id);
    if (
      !record ||
      record.kind !== FILESYSTEM_ENTRY_KIND.WIDGET ||
      !record.widgetId ||
      !record.widgetType
    ) {
      throw this.notFound();
    }
    const entry = toPublicEntry(record);
    if (entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) throw this.notFound();

    if (record.widgetType === WIDGET_TYPE.MEMO) {
      const memo = await this.publications.findMemo(record.widgetId);
      return {
        entry,
        type: WIDGET_TYPE.MEMO,
        data: {
          markdown: memo?.markdown ?? "",
          updatedAt:
            memo?.updatedAt === null || memo?.updatedAt === undefined
              ? null
              : new Date(memo.updatedAt).toISOString(),
        },
      };
    }
    if (record.widgetType === WIDGET_TYPE.DAILY_CHECKLIST) {
      const now = this.clock.now();
      const date = getKoreaDateContext(now);
      const repeatCycle = await this.publications.checklistRepeatCycle(record.widgetId);
      const items = await this.publications.listChecklistItems(
        record.widgetId,
        date.businessDate,
      );
      return {
        entry,
        type: WIDGET_TYPE.DAILY_CHECKLIST,
        data: toChecklistData(now, repeatCycle, items),
      };
    }
    throw this.notFound();
  }

  private async requirePublishedFile(id: string): Promise<FilesystemEntryRecord> {
    await this.requireEnabled();
    const entry = await this.publications.findPublishedEntry(id);
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) {
      throw this.notFound();
    }
    return entry;
  }

  private async requireEnabled(): Promise<void> {
    if (!(await this.publications.isGuestAccessEnabled())) {
      throw this.notFound();
    }
  }

  private notFound(): AppError {
    return new AppError(GUEST_ERRORS.RESOURCE_NOT_FOUND);
  }
}
