import { IMAGE_UPLOAD_ERRORS } from "@/constants/integrations/errors/image-upload";
import { NOVELAI_ERRORS } from "@/constants/integrations/errors/novelai";
import {
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
  IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE,
} from "@/constants/integrations/image-upload-profile";
import { normalizeContentType } from "@/domain/filesystem/file-name";
import { mediaContentTypeBase } from "@/domain/filesystem/media-type";
import {
  createImageUploadTemplateContext,
  renderImageUploadFileNameTemplate,
  renderImageUploadPathTemplate,
} from "@/domain/integrations/image-upload-profile";
import { AppError } from "@/domain/shared/errors";
import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type { FilesystemPathUseCases } from "@/types/filesystem/filesystem-service";
import type {
  ImageUploadContentType,
  ImageUploadProfileReader,
} from "@/types/integrations/image-upload-profile";
import type {
  ImageUploadInput,
  ImageUploadUseCases,
} from "@/types/integrations/image-upload";
import type { Clock, IdGenerator } from "@/types/platform/runtime";

export class ImageUploadService implements ImageUploadUseCases {
  constructor(
    private readonly profiles: ImageUploadProfileReader,
    private readonly paths: FilesystemPathUseCases,
    private readonly files: FileTransferUseCases,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async uploadImage(profileId: string, input: ImageUploadInput) {
    const profile = await this.profiles.requireEnabledProfile(profileId);
    const contentType = mediaContentTypeBase(
      normalizeContentType(input.contentType),
    );
    if (!isAllowedContentType(contentType, profile.contentTypes)) {
      throw new AppError(
        profile.id === DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ID
          ? NOVELAI_ERRORS.UNSUPPORTED_IMAGE_TYPE
          : IMAGE_UPLOAD_ERRORS.UNSUPPORTED_IMAGE_TYPE,
      );
    }

    const receivedAt = this.clock.now();
    const context = createImageUploadTemplateContext(
      receivedAt,
      profile.id,
      this.ids.generate(),
      IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE[contentType],
    );
    let parentId: string = profile.rootId;
    for (const directoryName of renderImageUploadPathTemplate(
      profile.pathTemplate,
      context,
    )) {
      parentId = (await this.paths.ensureDirectory(parentId, directoryName)).id;
    }

    return this.files.uploadFile({
      parentId,
      originalName: renderImageUploadFileNameTemplate(
        profile.fileNameTemplate,
        context,
      ),
      contentType,
      declaredSize: input.declaredSize,
      body: input.body,
    });
  }
}

function isAllowedContentType(
  contentType: string,
  allowed: readonly ImageUploadContentType[],
): contentType is ImageUploadContentType {
  return (
    Object.hasOwn(IMAGE_UPLOAD_EXTENSION_BY_CONTENT_TYPE, contentType) &&
    allowed.some((candidate) => candidate === contentType)
  );
}
