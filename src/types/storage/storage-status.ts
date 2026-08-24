import type {
  STORAGE_MIME_CATEGORY,
  STORAGE_OBJECT_PURPOSE,
} from "@/constants/storage/storage-status";

export type StorageMimeCategory =
  (typeof STORAGE_MIME_CATEGORY)[keyof typeof STORAGE_MIME_CATEGORY];

export type StorageObjectPurpose =
  (typeof STORAGE_OBJECT_PURPOSE)[keyof typeof STORAGE_OBJECT_PURPOSE];

export interface StorageUsageValue {
  readonly bytes: number;
  readonly objectCount: number;
}

export interface ObjectStorageUsage {
  readonly total: StorageUsageValue;
  readonly standard: StorageUsageValue;
  readonly byPurpose: Readonly<Record<StorageObjectPurpose, StorageUsageValue>>;
  readonly byMimeCategory: Readonly<
    Record<StorageMimeCategory, StorageUsageValue>
  >;
}

export interface DatabaseStorageUsage {
  readonly databaseBytes: number;
  readonly registeredFileCount: number;
  readonly directoryCount: number;
  readonly widgetCount: number;
  readonly trashItemCount: number;
}

export interface StorageStatusSnapshot {
  readonly measuredAt: string;
  readonly r2: ObjectStorageUsage;
  readonly d1: DatabaseStorageUsage;
}

export interface ObjectStorageUsageReader {
  readUsage(): Promise<ObjectStorageUsage>;
}

export interface DatabaseStorageUsageReader {
  readUsage(): Promise<DatabaseStorageUsage>;
}

export interface StorageStatusUseCases {
  getStatus(): Promise<StorageStatusSnapshot>;
}
