import type {
  GuestAccessSettings,
  GuestPublicationState,
} from "@/types/admin/guest-access";

export interface GuestAccessRepository {
  getSettings(): Promise<GuestAccessSettings>;
  saveSettings(enabled: boolean): Promise<GuestAccessSettings>;
  findPublicationStates(
    entryIds: readonly string[],
  ): Promise<ReadonlyMap<string, GuestPublicationState>>;
  setEntryPublished(
    entryId: string,
    recursive: boolean,
    published: boolean,
    publishedAt: number,
  ): Promise<number>;
}
