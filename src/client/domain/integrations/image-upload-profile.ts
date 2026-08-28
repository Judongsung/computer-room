import {
  IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE,
  IMAGE_UPLOAD_TEMPLATE_SAMPLE,
} from "@/constants/integrations/image-upload-profile";
import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import {
  normalizeImageUploadProfileConfiguration,
  renderImageUploadFileNameTemplate,
  renderImageUploadPathTemplate,
  type ImageUploadTemplateContext,
} from "@/domain/integrations/image-upload-profile";
import type { ImageUploadProfileDraft } from "@client/types/integrations/image-upload-profile";
import { IMAGE_UPLOAD_ROOT_LABEL } from "@client/constants/integrations/image-upload-profile";

export function imageUploadProfilePreview(draft: ImageUploadProfileDraft): string {
  const configuration = normalizeImageUploadProfileConfiguration(
    draft.id,
    draft,
  );
  const firstContentType = configuration.contentTypes[0];
  if (!firstContentType) return "";
  const context: ImageUploadTemplateContext = {
    profileId: draft.id,
    businessDate: IMAGE_UPLOAD_TEMPLATE_SAMPLE.BUSINESS_DATE,
    koreaTime: IMAGE_UPLOAD_TEMPLATE_SAMPLE.KOREA_TIME,
    uuid: IMAGE_UPLOAD_TEMPLATE_SAMPLE.UUID,
    extension: IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE[firstContentType],
  };
  return [
    IMAGE_UPLOAD_ROOT_LABEL[configuration.rootId],
    ...renderImageUploadPathTemplate(configuration.pathTemplate, context),
    renderImageUploadFileNameTemplate(configuration.fileNameTemplate, context),
  ].join("\\");
}

export function imageUploadProfileUrl(origin: string, id: string): string {
  return new URL(
    `${API_PATHS.INTEGRATIONS}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.IMAGES}`,
    origin,
  ).toString();
}
