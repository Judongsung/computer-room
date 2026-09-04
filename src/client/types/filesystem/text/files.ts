import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { FILE_OPEN_KIND } from "@client/constants/filesystem/text/file-opening";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";
import type { MediaViewerOpenRequest } from "@client/types/media/media";

export type FileOpenKind = (typeof FILE_OPEN_KIND)[keyof typeof FILE_OPEN_KIND];
export type FileDownloadSource = Pick<FilesystemContentGateway, "downloadUrl">;
export interface FileOpenHandlers {
  readonly media: (request: MediaViewerOpenRequest) => void;
  readonly text: (file: FilesystemFileEntry) => void;
  readonly download: (file: FilesystemFileEntry) => void;
}
export interface TextDocumentProps {
  readonly file: FilesystemFileEntry;
  readonly gateway: FileDownloadSource;
  readonly wrap?: "soft" | "off";
}
export interface DownloadConfirmationProps {
  readonly file: FilesystemFileEntry;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}
