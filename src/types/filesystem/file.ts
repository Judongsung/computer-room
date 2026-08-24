import type { FILE_STATUS } from "@/constants/filesystem/file";

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export interface FilePolicy {
  maxUploadSizeBytes: number;
}

export interface PublicFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export interface FilePage {
  items: PublicFile[];
  nextOffset: number | null;
}
