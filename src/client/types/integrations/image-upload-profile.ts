import type {
  CreateImageUploadProfileInput,
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
} from "@/types/integrations/image-upload-profile";

export interface ImageUploadProfileGateway {
  listProfiles(): Promise<readonly ImageUploadProfile[]>;
  createProfile(
    input: CreateImageUploadProfileInput,
  ): Promise<ImageUploadProfile>;
  updateProfile(
    id: string,
    input: ImageUploadProfileConfigurationInput,
  ): Promise<ImageUploadProfile>;
  deleteProfile(id: string): Promise<void>;
}

export interface ImageUploadProfileDraft
  extends ImageUploadProfileConfigurationInput {
  readonly id: string;
}
