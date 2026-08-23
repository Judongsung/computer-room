import { THUMBNAIL_ERRORS } from "../constants/errors/thumbnail";
import { FILE_STATUS } from "../constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "../constants/filesystem";
import { THUMBNAIL_SPEC } from "../constants/thumbnail";
import { AppError } from "../domain/errors";
import {
  isThumbnailSourceSupported,
  thumbnailObjectKey,
} from "../domain/thumbnail";
import { FILE_ERRORS } from "../constants/errors/file";
import type { FilesystemRepository } from "../types/repository";
import type { FileObjectStorage, StoredObjectBody } from "../types/storage";
import type {
  ImageThumbnailGenerator,
  ThumbnailUseCases,
} from "../types/thumbnail";

export class ThumbnailService implements ThumbnailUseCases {
  constructor(
    private readonly repository: FilesystemRepository,
    private readonly storage: FileObjectStorage,
    private readonly generator: ImageThumbnailGenerator,
  ) {}

  async getThumbnail(entryId: string): Promise<StoredObjectBody> {
    const source = await this.requireSource(entryId);
    const thumbnailKey = thumbnailObjectKey(source.fileId);
    const cached = await this.storage.get(thumbnailKey);
    if (cached) {
      return cached;
    }

    const original = await this.storage.get(source.objectKey);
    if (!original) {
      throw new AppError(FILE_ERRORS.FILE_CONTENT_NOT_FOUND);
    }

    try {
      const generated = await this.generator.generate(original.body);
      if (generated.contentType !== THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE) {
        throw new Error(THUMBNAIL_ERRORS.GENERATION_FAILED.code);
      }
      await this.storage.put(
        thumbnailKey,
        generated.body,
        generated.contentType,
      );
      const stored = await this.storage.get(thumbnailKey);
      if (!stored) {
        throw new Error(THUMBNAIL_ERRORS.GENERATION_FAILED.code);
      }
      return stored;
    } catch {
      throw new AppError(THUMBNAIL_ERRORS.GENERATION_FAILED);
    }
  }

  private async requireSource(entryId: string): Promise<{
    readonly fileId: string;
    readonly objectKey: string;
  }> {
    const entry = await this.repository.findEntry(entryId);
    if (
      !entry ||
      entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      entry.fileStatus !== FILE_STATUS.READY ||
      !entry.fileId ||
      !entry.objectKey ||
      entry.contentType === null ||
      entry.size === null ||
      !(await this.isReadableLocation(entryId))
    ) {
      throw new AppError(FILE_ERRORS.FILE_NOT_FOUND);
    }
    if (entry.size > THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES) {
      throw new AppError(THUMBNAIL_ERRORS.SOURCE_TOO_LARGE);
    }
    if (!isThumbnailSourceSupported(entry.contentType, entry.size)) {
      throw new AppError(THUMBNAIL_ERRORS.UNSUPPORTED_SOURCE);
    }
    return { fileId: entry.fileId, objectKey: entry.objectKey };
  }

  private async isReadableLocation(entryId: string): Promise<boolean> {
    const matches = await Promise.all(
      FILESYSTEM_SYSTEM_ROOT_IDS.map((rootId) =>
        this.repository.isWithinRoot(entryId, rootId),
      ),
    );
    return matches.some(Boolean);
  }
}
