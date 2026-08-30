import {
  API_QUERY_PARAMETERS,
  IMAGE_UPLOAD_LOGS_API_PATH,
} from "@/constants/platform/api";
import { isImageUploadLogPage } from "@client/api/integrations/image-upload-log-api-contract";
import { requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type {
  ImageUploadLogGateway,
  ImageUploadLogListQuery,
} from "@client/types/integrations/image-upload-log";
import type { ImageUploadLogPage } from "@/types/integrations/image-upload-log";

export class ImageUploadLogApiClient implements ImageUploadLogGateway {
  async listImageUploadLogs(
    query: ImageUploadLogListQuery,
  ): Promise<ImageUploadLogPage> {
    const parameters = new URLSearchParams();
    if (query.profileId) {
      parameters.set(API_QUERY_PARAMETERS.PROFILE_ID, query.profileId);
    }
    if (query.outcome) {
      parameters.set(API_QUERY_PARAMETERS.OUTCOME, query.outcome);
    }
    if (query.cursor) {
      parameters.set(API_QUERY_PARAMETERS.CURSOR, query.cursor);
    }
    const queryString = parameters.toString();
    const payload = await requestJson(
      queryString
        ? `${IMAGE_UPLOAD_LOGS_API_PATH}?${queryString}`
        : IMAGE_UPLOAD_LOGS_API_PATH,
    );
    if (!isImageUploadLogPage(payload)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return payload;
  }
}
