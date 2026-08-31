import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import type {
  GuestProgramDocument,
  GuestSessionInfo,
} from "@/types/guest/guest";
import type { GuestSessionGateway } from "@client/types/platform/access";

export interface GuestGateway extends GuestSessionGateway {
  listDirectory(
    directoryId: string,
    offset?: number,
  ): Promise<FilesystemDirectoryPage>;
  getProgramDocument(entryId: string): Promise<GuestProgramDocument>;
  downloadUrl(entryId: string): string;
  contentUrl(entryId: string): string;
  thumbnailUrl(entryId: string): string;
}

export interface GuestApplicationProps {
  readonly session: GuestSessionInfo;
  readonly gateway: GuestGateway;
}
