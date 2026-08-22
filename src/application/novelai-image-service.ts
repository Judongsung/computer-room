import { NOVELAI_ERRORS } from "../constants/errors/novelai";
import { NOVELAI_STORAGE_PATH } from "../constants/novelai";
import { AppError } from "../domain/errors";
import { normalizeContentType } from "../domain/file-name";
import { getKoreaDateContext } from "../domain/korea-date";
import { mediaContentTypeBase } from "../domain/media-type";
import {
  isNovelAiImageContentType,
  novelAiImageFileName,
} from "../domain/novelai-image";
import type { FileUseCases } from "../types/file-service";
import type { FilesystemFileEntry } from "../types/filesystem";
import type { FilesystemPathUseCases } from "../types/filesystem-service";
import type {
  NovelAiImageUploadInput,
  NovelAiImageUseCases,
} from "../types/novelai";
import type { Clock, IdGenerator } from "../types/runtime";

export class NovelAiImageService implements NovelAiImageUseCases {
  constructor(
    private readonly paths: FilesystemPathUseCases,
    private readonly files: FileUseCases,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async uploadImage(
    input: NovelAiImageUploadInput,
  ): Promise<FilesystemFileEntry> {
    const contentType = mediaContentTypeBase(
      normalizeContentType(input.contentType),
    );
    if (!isNovelAiImageContentType(contentType)) {
      throw new AppError(NOVELAI_ERRORS.UNSUPPORTED_IMAGE_TYPE);
    }

    const receivedAt = this.clock.now();
    const { businessDate } = getKoreaDateContext(receivedAt);
    const baseDirectory = await this.paths.ensureDirectory(
      NOVELAI_STORAGE_PATH.ROOT_ID,
      NOVELAI_STORAGE_PATH.DIRECTORY_NAME,
    );
    const dateDirectory = await this.paths.ensureDirectory(
      baseDirectory.id,
      businessDate,
    );
    const originalName = novelAiImageFileName(
      receivedAt,
      this.idGenerator.generate(),
      contentType,
    );

    return this.files.uploadFile({
      parentId: dateDirectory.id,
      originalName,
      contentType,
      declaredSize: input.declaredSize,
      body: input.body,
    });
  }
}
