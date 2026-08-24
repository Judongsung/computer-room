import type { FilePage } from "@/types/filesystem/file";
import type {
  FilesystemDownload,
  FilesystemContent,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "@/types/filesystem/filesystem";
import type { RequestedByteRange } from "@/types/filesystem/media";

export interface FileUseCases {
  listFiles(offset: number, limit: number): Promise<FilePage>;
  uploadFile(input: UploadFilesystemFileInput): Promise<FilesystemFileEntry>;
  downloadFile(id: string): Promise<FilesystemDownload>;
  streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent>;
}
