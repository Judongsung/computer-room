import type {
  FilesystemBreadcrumb,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { ChecklistItemRecord } from "@/types/widgets/checklist";
import type { MemoRecord } from "@/types/widgets/memo";

export interface GuestPublicationRepository {
  isGuestAccessEnabled(): Promise<boolean>;
  findVisibleDirectory(id: string): Promise<FilesystemEntryRecord | null>;
  findPublishedEntry(id: string): Promise<FilesystemEntryRecord | null>;
  listVisibleChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]>;
  listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]>;
  findMemo(widgetId: string): Promise<MemoRecord | null>;
  listChecklistItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]>;
}
