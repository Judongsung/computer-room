import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { readDeclaredFileSize } from "@/http/filesystem/file-upload-request";
import { jsonResponse } from "@/http/shared/responses";
import type {
  ImageUploadResponse,
  ImageUploadUseCases,
} from "@/types/integrations/image-upload";
import type { ServiceApiHandler } from "@/types/platform/http";

const IMAGE_UPLOAD_PATH = new RegExp(
  `^${API_PATHS.INTEGRATIONS}/([^/]+)/${API_PATH_SEGMENTS.IMAGES}$`,
);

export class ImageUploadApiHandler implements ServiceApiHandler {
  constructor(private readonly images: ImageUploadUseCases) {}

  matches(url: URL): boolean {
    return IMAGE_UPLOAD_PATH.test(url.pathname);
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    const match = IMAGE_UPLOAD_PATH.exec(url.pathname);
    if (!match) return null;
    if (request.method !== HTTP_METHOD.POST) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }

    const file = await this.images.uploadImage(
      decodeURIComponent(match[1] ?? ""),
      {
        contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
        declaredSize: readDeclaredFileSize(request),
        body: request.body,
      },
    );
    return jsonResponse({ file } satisfies ImageUploadResponse, HTTP_STATUS.CREATED);
  }
}
