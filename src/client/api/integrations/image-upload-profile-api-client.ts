import { IMAGE_UPLOAD_PROFILES_API_PATH } from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import {
  isImageUploadProfile,
  isImageUploadProfileCollection,
} from "@/domain/integrations/image-upload-profile-contract";
import type {
  CreateImageUploadProfileInput,
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
} from "@/types/integrations/image-upload-profile";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";
import { isRecord } from "@client/api/shared/api-contract";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";

export class ImageUploadProfileApiClient
  implements ImageUploadProfileGateway
{
  async listProfiles(): Promise<readonly ImageUploadProfile[]> {
    const payload = await requestJson(IMAGE_UPLOAD_PROFILES_API_PATH);
    if (!isImageUploadProfileCollection(payload)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return payload.items;
  }

  async createProfile(
    input: CreateImageUploadProfileInput,
  ): Promise<ImageUploadProfile> {
    return this.requestProfile(
      IMAGE_UPLOAD_PROFILES_API_PATH,
      jsonRequest(HTTP_METHOD.POST, input),
    );
  }

  async updateProfile(
    id: string,
    input: ImageUploadProfileConfigurationInput,
  ): Promise<ImageUploadProfile> {
    return this.requestProfile(
      profilePath(id),
      jsonRequest(HTTP_METHOD.PUT, input),
    );
  }

  async deleteProfile(id: string): Promise<void> {
    await requestJson(profilePath(id), { method: HTTP_METHOD.DELETE });
  }

  private async requestProfile(
    path: string,
    options: RequestInit,
  ): Promise<ImageUploadProfile> {
    const payload = await requestJson(path, options);
    if (!isRecord(payload) || !isImageUploadProfile(payload.profile)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return payload.profile;
  }
}

function profilePath(id: string): string {
  return `${IMAGE_UPLOAD_PROFILES_API_PATH}/${encodeURIComponent(id)}`;
}
