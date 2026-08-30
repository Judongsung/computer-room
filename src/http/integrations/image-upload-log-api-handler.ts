import {
  API_QUERY_PARAMETERS,
  IMAGE_UPLOAD_LOGS_API_PATH,
} from "@/constants/platform/api";
import {
  IMAGE_UPLOAD_LOG_OUTCOME_VALUES,
} from "@/constants/integrations/image-upload-log";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_METHOD,
  HTTP_STATUS,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import {
  decodeImageUploadLogCursor,
  imageUploadLogProfileId,
} from "@/domain/integrations/image-upload-log";
import { AppError } from "@/domain/shared/errors";
import { jsonResponse } from "@/http/shared/responses";
import type {
  ImageUploadLogOutcome,
  ImageUploadLogQuery,
  ImageUploadLogResponse,
  ImageUploadLogUseCases,
} from "@/types/integrations/image-upload-log";
import type { FeatureApiHandler } from "@/types/platform/http";

export class ImageUploadLogApiHandler implements FeatureApiHandler {
  constructor(private readonly logs: ImageUploadLogUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== IMAGE_UPLOAD_LOGS_API_PATH) return null;
    if (request.method !== HTTP_METHOD.GET) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }
    const page = await this.logs.listLogs(readQuery(url.searchParams));
    return jsonResponse(
      page satisfies ImageUploadLogResponse,
      HTTP_STATUS.OK,
      PRIVATE_NO_STORE_RESPONSE_HEADERS,
    );
  }
}

function readQuery(parameters: URLSearchParams): ImageUploadLogQuery {
  const profileValue = parameters.get(API_QUERY_PARAMETERS.PROFILE_ID);
  const outcomeValue = parameters.get(API_QUERY_PARAMETERS.OUTCOME);
  const cursorValue = parameters.get(API_QUERY_PARAMETERS.CURSOR);
  const profileId = profileValue
    ? imageUploadLogProfileId(profileValue)
    : undefined;
  const outcome = outcomeValue
    ? IMAGE_UPLOAD_LOG_OUTCOME_VALUES.find(
        (candidate) => candidate === outcomeValue,
      )
    : undefined;
  const cursor = cursorValue
    ? decodeImageUploadLogCursor(cursorValue)
    : undefined;
  if (
    (profileValue !== null && !profileId) ||
    (outcomeValue !== null && !outcome) ||
    (cursorValue !== null && !cursor)
  ) {
    throw new AppError(HTTP_ERRORS.INVALID_QUERY);
  }
  return {
    ...(profileId ? { profileId } : {}),
    ...(outcome ? { outcome: outcome as ImageUploadLogOutcome } : {}),
    ...(cursor ? { cursor } : {}),
  };
}
