import { NOVELAI_IMAGE_UPLOAD_API_PATH } from "../constants/api";
import { HTTP_ERRORS } from "../constants/errors/http";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "../constants/http";
import { AppError } from "../domain/errors";
import type { FeatureApiHandler } from "../types/http";
import type {
  NovelAiImageUploadResponse,
  NovelAiImageUseCases,
} from "../types/novelai";
import { readDeclaredFileSize } from "./file-upload-request";
import { jsonResponse } from "./responses";

export class NovelAiImageApiHandler implements FeatureApiHandler {
  constructor(private readonly images: NovelAiImageUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== NOVELAI_IMAGE_UPLOAD_API_PATH) {
      return null;
    }
    if (request.method !== HTTP_METHOD.POST) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }

    const file = await this.images.uploadImage({
      contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
      declaredSize: readDeclaredFileSize(request),
      body: request.body,
    });
    const response = { file } satisfies NovelAiImageUploadResponse;
    return jsonResponse(response, HTTP_STATUS.CREATED);
  }
}
