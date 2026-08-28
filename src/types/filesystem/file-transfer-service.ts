import type {
  FilesystemDownload,
  FilesystemContent,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "@/types/filesystem/filesystem";
import type { RequestedByteRange } from "@/types/filesystem/media";

export interface FileTransferUseCases {
  uploadFile(input: UploadFilesystemFileInput): Promise<FilesystemFileEntry>;
  downloadFile(id: string): Promise<FilesystemDownload>;
  streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent>;
}
