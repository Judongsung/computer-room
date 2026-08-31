import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { imageUploadLogProfileId } from "@/domain/integrations/image-upload-log";
import { readDeclaredFileSize } from "@/http/filesystem/file-upload-request";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { publicErrorDefinition } from "@/http/shared/public-error";
import { jsonResponse } from "@/http/shared/responses";
import {
  IMAGE_UPLOAD_LOG_OUTCOME,
} from "@/constants/integrations/image-upload-log";
import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";
import type {
  ImageUploadResponse,
  ImageUploadUseCases,
} from "@/types/integrations/image-upload";
import type { ImageUploadLogRecorder } from "@/types/integrations/image-upload-log";
import type { ServiceApiHandler } from "@/types/platform/http";
import type { BackgroundTaskScheduler, Clock } from "@/types/platform/runtime";

const IMAGE_UPLOAD_PATH = createExactApiRoutePattern(
  API_PATHS.INTEGRATIONS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.IMAGES,
);

export class ImageUploadApiHandler implements ServiceApiHandler {
  constructor(
    private readonly images: ImageUploadUseCases,
    private readonly logs: ImageUploadLogRecorder,
    private readonly clock: Clock,
    private readonly backgroundTasks: BackgroundTaskScheduler,
  ) {}

  matches(url: URL): boolean {
    return IMAGE_UPLOAD_PATH.test(url.pathname);
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    const match = IMAGE_UPLOAD_PATH.exec(url.pathname);
    if (!match) return null;
    if (request.method !== HTTP_METHOD.POST) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }

    const receivedAt = this.clock.now();
    const contentType = request.headers.get(HTTP_HEADERS.CONTENT_TYPE);
    let profileId: string | null = null;
    let declaredSize: number | null = null;
    try {
      const requestedProfileId = readApiRouteSegment(match);
      profileId = imageUploadLogProfileId(requestedProfileId);
      declaredSize = readDeclaredFileSize(request);
      const file = await this.images.uploadImage(requestedProfileId, {
        contentType,
        declaredSize,
        body: request.body,
      });
      this.scheduleLog({
        profileId,
        contentType,
        declaredSize,
        receivedAt,
        durationMs: this.clock.now() - receivedAt,
        outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
        file,
      });
      return jsonResponse(
        { file } satisfies ImageUploadResponse,
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      this.scheduleLog({
        profileId,
        contentType,
        declaredSize,
        receivedAt,
        durationMs: this.clock.now() - receivedAt,
        outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
        error: publicErrorDefinition(error),
      });
      throw error;
    }
  }

  private scheduleLog(
    input: Parameters<ImageUploadLogRecorder["record"]>[0],
  ): void {
    this.backgroundTasks.schedule(
      Promise.resolve().then(() => this.logs.record(input)),
      BACKGROUND_TASK_FAILURE_CODE.IMAGE_UPLOAD_LOG_RECORDING,
    );
  }
}
