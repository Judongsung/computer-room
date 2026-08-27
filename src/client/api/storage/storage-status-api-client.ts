import { API_PATHS } from "@/constants/platform/api";
import { isStorageStatusSnapshot } from "@/domain/storage/storage-status";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { isRecord } from "@client/api/shared/api-contract";
import { requestJson } from "@client/api/shared/api-request";

export class StorageStatusApiClient implements StorageStatusGateway {
  private pending: Promise<StorageStatusSnapshot> | null = null;

  getStatus(): Promise<StorageStatusSnapshot> {
    if (this.pending) return this.pending;
    this.pending = this.requestStatus().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async requestStatus(): Promise<StorageStatusSnapshot> {
    const payload = await requestJson(API_PATHS.STORAGE_STATUS);
    if (!isRecord(payload) || !isStorageStatusSnapshot(payload.status)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return payload.status;
  }
}
