import { IMAGE_UPLOAD_PROFILES_API_PATH } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_METHOD,
  HTTP_STATUS,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { readJsonBody } from "@/http/shared/request-body";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";
import type {
  CreateImageUploadProfileInput,
  ImageUploadProfileConfigurationInput,
  ImageUploadProfileUseCases,
} from "@/types/integrations/image-upload-profile";
import type { FeatureApiHandler } from "@/types/platform/http";

const PROFILE_PATH = new RegExp(`^${IMAGE_UPLOAD_PROFILES_API_PATH}/([^/]+)$`);

export class ImageUploadProfileApiHandler implements FeatureApiHandler {
  constructor(private readonly profiles: ImageUploadProfileUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === IMAGE_UPLOAD_PROFILES_API_PATH) {
      if (request.method === HTTP_METHOD.GET) {
        return this.response({ items: await this.profiles.listProfiles() });
      }
      if (request.method === HTTP_METHOD.POST) {
        const input = readCreateInput(await readJsonBody(request));
        return this.response(
          { profile: await this.profiles.createProfile(input) },
          HTTP_STATUS.CREATED,
        );
      }
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }

    const match = PROFILE_PATH.exec(url.pathname);
    if (!match) return null;
    const id = decodeURIComponent(match[1] ?? "");
    if (request.method === HTTP_METHOD.PUT) {
      const input = readConfigurationInput(await readJsonBody(request), false);
      return this.response({
        profile: await this.profiles.updateProfile(id, input),
      });
    }
    if (request.method === HTTP_METHOD.DELETE) {
      await this.profiles.deleteProfile(id);
      return emptyResponse(undefined, PRIVATE_NO_STORE_RESPONSE_HEADERS);
    }
    throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
  }

  private response(body: unknown, status?: number): Response {
    return jsonResponse(body, status, PRIVATE_NO_STORE_RESPONSE_HEADERS);
  }
}

function readCreateInput(value: unknown): CreateImageUploadProfileInput {
  const configuration = readConfigurationInput(value, true);
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
  return { id: value.id, ...configuration };
}

function readConfigurationInput(
  value: unknown,
  allowId: boolean,
): ImageUploadProfileConfigurationInput {
  if (
    !isRecord(value) ||
    (!allowId && Object.hasOwn(value, "id")) ||
    typeof value.displayName !== "string" ||
    typeof value.rootId !== "string" ||
    typeof value.pathTemplate !== "string" ||
    typeof value.fileNameTemplate !== "string" ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.contentTypes) ||
    !value.contentTypes.every((contentType) => typeof contentType === "string")
  ) {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
  return {
    displayName: value.displayName,
    rootId: value.rootId,
    pathTemplate: value.pathTemplate,
    fileNameTemplate: value.fileNameTemplate,
    enabled: value.enabled,
    contentTypes: value.contentTypes,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
