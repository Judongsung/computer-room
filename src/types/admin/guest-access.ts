import type { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectoryEntry,
  FilesystemDirectorySort,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";

export type GuestPublicationState =
  (typeof GUEST_PUBLICATION_STATE)[keyof typeof GUEST_PUBLICATION_STATE];

export interface GuestAccessSettings {
  readonly enabled: boolean;
}

export interface GuestAccessEntry {
  readonly entry: FilesystemEntry;
  readonly publicationState: GuestPublicationState;
}

export interface GuestAccessDirectoryPage {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly items: readonly GuestAccessEntry[];
  readonly nextOffset: number | null;
  readonly sort: FilesystemDirectorySort;
}

export interface GuestPublicationMutationResult {
  readonly entryId: string;
  readonly publicationState: GuestPublicationState;
  readonly affectedCount: number;
}
