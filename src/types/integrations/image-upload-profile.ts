import type {
  IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE,
  IMAGE_UPLOAD_PROFILE_ROOT_IDS,
} from "@/constants/integrations/image-upload-profile";

export type ImageUploadContentType =
  keyof typeof IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE;
export type ImageUploadProfileRootId =
  (typeof IMAGE_UPLOAD_PROFILE_ROOT_IDS)[number];

export interface ImageUploadProfileConfigurationInput {
  readonly displayName: string;
  readonly rootId: string;
  readonly pathTemplate: string;
  readonly fileNameTemplate: string;
  readonly enabled: boolean;
  readonly contentTypes: readonly string[];
}

export interface CreateImageUploadProfileInput
  extends ImageUploadProfileConfigurationInput {
  readonly id: string;
}

export interface ValidatedImageUploadProfileConfiguration {
  readonly displayName: string;
  readonly rootId: ImageUploadProfileRootId;
  readonly pathTemplate: string;
  readonly fileNameTemplate: string;
  readonly enabled: boolean;
  readonly contentTypes: readonly ImageUploadContentType[];
}

export interface StoredImageUploadProfile
  extends ValidatedImageUploadProfileConfiguration {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ImageUploadProfile
  extends ValidatedImageUploadProfileConfiguration {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageUploadProfileRepository {
  list(): Promise<StoredImageUploadProfile[]>;
  find(id: string): Promise<StoredImageUploadProfile | null>;
  insert(profile: StoredImageUploadProfile): Promise<boolean>;
  replace(profile: StoredImageUploadProfile): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface ImageUploadProfileUseCases {
  listProfiles(): Promise<ImageUploadProfile[]>;
  createProfile(input: CreateImageUploadProfileInput): Promise<ImageUploadProfile>;
  updateProfile(
    id: string,
    input: ImageUploadProfileConfigurationInput,
  ): Promise<ImageUploadProfile>;
  deleteProfile(id: string): Promise<void>;
}

export interface ImageUploadProfileReader {
  requireEnabledProfile(id: string): Promise<ImageUploadProfile>;
}
