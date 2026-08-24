import {
  STORAGE_STATUS_ERRORS,
  STORAGE_STATUS_LOG_MESSAGES,
} from "../constants/errors/storage-status";
import { AppError } from "../domain/errors";
import type { Clock } from "../types/runtime";
import type {
  DatabaseStorageUsageReader,
  ObjectStorageUsageReader,
  StorageStatusSnapshot,
  StorageStatusUseCases,
} from "../types/storage-status";

export class StorageStatusService implements StorageStatusUseCases {
  constructor(
    private readonly objects: ObjectStorageUsageReader,
    private readonly database: DatabaseStorageUsageReader,
    private readonly clock: Clock,
  ) {}

  async getStatus(): Promise<StorageStatusSnapshot> {
    try {
      const [r2, d1] = await Promise.all([
        this.objects.readUsage(),
        this.database.readUsage(),
      ]);
      return {
        measuredAt: new Date(this.clock.now()).toISOString(),
        r2,
        d1,
      };
    } catch {
      console.error(STORAGE_STATUS_LOG_MESSAGES.LOAD_FAILED);
      throw new AppError(STORAGE_STATUS_ERRORS.LOAD_FAILED);
    }
  }
}
