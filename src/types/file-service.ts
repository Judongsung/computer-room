import type {
  FileDownload,
  FilePage,
  PublicFile,
  UploadFileInput,
} from "./file";

export interface FileUseCases {
  listFiles(offset: number, limit: number): Promise<FilePage>;
  uploadFile(input: UploadFileInput): Promise<PublicFile>;
  downloadFile(id: string): Promise<FileDownload>;
  deleteFile(id: string): Promise<void>;
}
