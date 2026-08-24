import { API_PATHS } from "@/constants/platform/api";
import {
  HTTP_METHOD,
  HTTP_STATUS,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { StorageStatusUseCases } from "@/types/storage/storage-status";
import { jsonResponse } from "@/http/shared/responses";

export class StorageStatusApiHandler implements FeatureApiHandler {
  constructor(private readonly storageStatus: StorageStatusUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== API_PATHS.STORAGE_STATUS) return null;
    if (request.method !== HTTP_METHOD.GET) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }
    return jsonResponse(
      { status: await this.storageStatus.getStatus() },
      HTTP_STATUS.OK,
      PRIVATE_NO_STORE_RESPONSE_HEADERS,
    );
  }
}
