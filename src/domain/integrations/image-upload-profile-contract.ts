import {
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  IMAGE_UPLOAD_PROFILE_ROOT_IDS,
} from "@/constants/integrations/image-upload-profile";
import type { ImageUploadProfile } from "@/types/integrations/image-upload-profile";

export function isImageUploadProfile(
  value: unknown,
): value is ImageUploadProfile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    IMAGE_UPLOAD_PROFILE_ROOT_IDS.some((rootId) => rootId === value.rootId) &&
    typeof value.pathTemplate === "string" &&
    typeof value.fileNameTemplate === "string" &&
    typeof value.enabled === "boolean" &&
    Array.isArray(value.contentTypes) &&
    value.contentTypes.every(
      (contentType) =>
        typeof contentType === "string" &&
        IMAGE_UPLOAD_CONTENT_TYPE_VALUES.some(
          (supported) => supported === contentType,
        ),
    ) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function isImageUploadProfileCollection(
  value: unknown,
): value is { readonly items: readonly ImageUploadProfile[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isImageUploadProfile)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
