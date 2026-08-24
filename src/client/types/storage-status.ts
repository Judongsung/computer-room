import type { StorageStatusSnapshot } from "../../types/storage-status";

export interface StorageStatusGateway {
  getStatus(): Promise<StorageStatusSnapshot>;
}
