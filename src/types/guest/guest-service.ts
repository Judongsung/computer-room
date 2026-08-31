import type {
  FilesystemContent,
  FilesystemDirectoryPage,
  FilesystemDownload,
} from "@/types/filesystem/filesystem";
import type { RequestedByteRange } from "@/types/filesystem/media";
import type { StoredObjectBody } from "@/types/filesystem/storage";
import type {
  GuestProgramDocument,
  GuestSessionInfo,
} from "@/types/guest/guest";
import type { GUEST_RATE_LIMIT_CATEGORY } from "@/constants/guest/guest";

export type GuestRateLimitCategory =
  (typeof GUEST_RATE_LIMIT_CATEGORY)[keyof typeof GUEST_RATE_LIMIT_CATEGORY];

export interface GuestRequestRateLimiter {
  allow(request: Request, category: GuestRateLimitCategory): Promise<boolean>;
}

export interface GuestUseCases {
  getSession(): Promise<GuestSessionInfo>;
  listDirectory(
    directoryId: string,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage>;
  downloadFile(id: string): Promise<FilesystemDownload>;
  streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent>;
  getThumbnail(id: string): Promise<StoredObjectBody>;
  getProgramDocument(id: string): Promise<GuestProgramDocument>;
}
