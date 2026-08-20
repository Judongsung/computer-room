import type { FileMetadata } from "./file";

export interface FileMetadataRepository {
  insertPending(file: FileMetadata): Promise<void>;
  markReady(id: string, size: number, etag: string): Promise<void>;
  findReadyById(id: string): Promise<FileMetadata | null>;
  listReady(offset: number, limit: number): Promise<FileMetadata[]>;
  delete(id: string): Promise<void>;
}
