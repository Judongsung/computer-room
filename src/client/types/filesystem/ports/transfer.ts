import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type {
  DesktopPlacement,
  FilesystemFileEntry,
} from "@/types/filesystem/filesystem";

export interface FilesystemTransferGateway {
  uploadFile(
    parentId: string,
    file: File,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemFileEntry>;
  createDownloadManifest(
    ids: readonly string[],
  ): Promise<FilesystemDownloadManifest>;
  downloadUrl(id: string): string;
  contentUrl(id: string): string;
  thumbnailUrl(id: string): string;
}

export type FilesystemDownloadGateway = Pick<
  FilesystemTransferGateway,
  "createDownloadManifest" | "downloadUrl"
>;

export type FilesystemContentGateway = Pick<
  FilesystemTransferGateway,
  "downloadUrl" | "contentUrl" | "thumbnailUrl"
>;
