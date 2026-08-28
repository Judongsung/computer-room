import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import {
  normalizeImageUploadProfileConfiguration,
  normalizeImageUploadProfileId,
} from "@/domain/integrations/image-upload-profile";
import { AppError } from "@/domain/shared/errors";
import type {
  CreateImageUploadProfileInput,
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
  ImageUploadProfileReader,
  ImageUploadProfileRepository,
  ImageUploadProfileUseCases,
  StoredImageUploadProfile,
} from "@/types/integrations/image-upload-profile";
import type { Clock } from "@/types/platform/runtime";

export class ImageUploadProfileService
  implements ImageUploadProfileUseCases, ImageUploadProfileReader
{
  constructor(
    private readonly profiles: ImageUploadProfileRepository,
    private readonly clock: Clock,
  ) {}

  async listProfiles(): Promise<ImageUploadProfile[]> {
    return Promise.all((await this.profiles.list()).map(toPublicProfile));
  }

  async createProfile(
    input: CreateImageUploadProfileInput,
  ): Promise<ImageUploadProfile> {
    const id = normalizeImageUploadProfileId(input.id);
    if (await this.profiles.find(id)) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.ID_ALREADY_EXISTS);
    }
    const now = this.clock.now();
    const profile = {
      id,
      ...normalizeImageUploadProfileConfiguration(id, input),
      createdAt: now,
      updatedAt: now,
    } satisfies StoredImageUploadProfile;
    if (!(await this.profiles.insert(profile))) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.ID_ALREADY_EXISTS);
    }
    return toPublicProfile(profile);
  }

  async updateProfile(
    requestedId: string,
    input: ImageUploadProfileConfigurationInput,
  ): Promise<ImageUploadProfile> {
    const id = normalizeImageUploadProfileId(requestedId);
    const existing = await this.profiles.find(id);
    if (!existing) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
    }
    const profile = {
      id,
      ...normalizeImageUploadProfileConfiguration(id, input),
      createdAt: existing.createdAt,
      updatedAt: this.clock.now(),
    } satisfies StoredImageUploadProfile;
    if (!(await this.profiles.replace(profile))) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
    }
    return toPublicProfile(profile);
  }

  async deleteProfile(requestedId: string): Promise<void> {
    const id = normalizeImageUploadProfileId(requestedId);
    if (!(await this.profiles.delete(id))) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
    }
  }

  async requireEnabledProfile(requestedId: string): Promise<ImageUploadProfile> {
    let id: string;
    try {
      id = normalizeImageUploadProfileId(requestedId);
    } catch {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
    }
    const profile = await this.profiles.find(id);
    if (!profile || !profile.enabled) {
      throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
    }
    return toPublicProfile(profile);
  }
}

function toPublicProfile(
  stored: StoredImageUploadProfile,
): ImageUploadProfile {
  try {
    const id = normalizeImageUploadProfileId(stored.id);
    const configuration = normalizeImageUploadProfileConfiguration(id, stored);
    if (
      !Number.isFinite(stored.createdAt) ||
      !Number.isFinite(stored.updatedAt)
    ) {
      throw new Error("Invalid profile timestamp.");
    }
    return {
      id,
      ...configuration,
      createdAt: new Date(stored.createdAt).toISOString(),
      updatedAt: new Date(stored.updatedAt).toISOString(),
    };
  } catch {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_STORED_PROFILE);
  }
}
