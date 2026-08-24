import type { StorageStatusSnapshot } from "@/types/storage/storage-status";

export interface StorageStatusGateway {
  getStatus(): Promise<StorageStatusSnapshot>;
}
