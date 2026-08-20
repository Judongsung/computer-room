import type { StoredObjectBody } from "./storage";
import type { FILE_STATUS } from "../constants/file";

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export interface FilePolicy {
  maxUploadSizeBytes: number;
}

export interface FileMetadata {
  id: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  size: number;
  etag: string | null;
  status: FileStatus;
  createdAt: number;
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

export interface UploadFileInput {
  originalName: string;
  contentType: string | null;
  declaredSize: number;
  body: ReadableStream<Uint8Array> | null;
}

export interface FileDownload {
  metadata: FileMetadata;
  object: StoredObjectBody;
}
