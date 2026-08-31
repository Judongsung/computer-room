import type {
  GuestAccessDirectoryPage,
  GuestAccessSettings,
  GuestPublicationMutationResult,
} from "@/types/admin/guest-access";

export interface GuestAccessUseCases {
  getSettings(): Promise<GuestAccessSettings>;
  updateSettings(enabled: boolean): Promise<GuestAccessSettings>;
  listDirectory(
    directoryId: string,
    offset: number,
    limit: number,
  ): Promise<GuestAccessDirectoryPage>;
  setEntryPublished(
    entryId: string,
    published: boolean,
  ): Promise<GuestPublicationMutationResult>;
}
