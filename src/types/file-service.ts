import type { FilePage } from "./file";
import type {
  FilesystemDownload,
  FilesystemContent,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "./filesystem";
import type { RequestedByteRange } from "./media";

export interface FileUseCases {
  listFiles(offset: number, limit: number): Promise<FilePage>;
  uploadFile(input: UploadFilesystemFileInput): Promise<FilesystemFileEntry>;
  downloadFile(id: string): Promise<FilesystemDownload>;
  streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent>;
}
