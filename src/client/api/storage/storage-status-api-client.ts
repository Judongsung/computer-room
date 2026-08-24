import { API_PATHS } from "@/constants/platform/api";
import { isStorageStatusSnapshot } from "@/domain/storage/storage-status";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { ApiError } from "@client/api/widgets/dashboard-api-client";

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
    const response = await fetch(API_PATHS.STORAGE_STATUS, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = readApiError(payload);
      throw new ApiError(error.code, error.message, response.status);
    }
    if (!isRecord(payload) || !isStorageStatusSnapshot(payload.status)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return payload.status;
  }
}

function readApiError(value: unknown): { code: string; message: string } {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  ) {
    return { code: value.error.code, message: value.error.message };
  }
  return CLIENT_ERRORS.REQUEST_FAILED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
