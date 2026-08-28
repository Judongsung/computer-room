import type { FILE_STATUS } from "@/constants/filesystem/file";

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export interface FilePolicy {
  maxUploadSizeBytes: number;
}
