import type { FilePage } from "./file";
import type {
  FilesystemDownload,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "./filesystem";

export interface FileUseCases {
  listFiles(offset: number, limit: number): Promise<FilePage>;
  uploadFile(input: UploadFilesystemFileInput): Promise<FilesystemFileEntry>;
  downloadFile(id: string): Promise<FilesystemDownload>;
}
