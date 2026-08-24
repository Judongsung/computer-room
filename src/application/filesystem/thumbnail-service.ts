import { THUMBNAIL_ERRORS } from "@/constants/filesystem/errors/thumbnail";
import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "@/constants/filesystem/filesystem";
import { THUMBNAIL_SPEC } from "@/constants/filesystem/thumbnail";
import { AppError } from "@/domain/shared/errors";
import {
  isThumbnailSourceSupported,
  thumbnailObjectKey,
} from "@/domain/filesystem/thumbnail";
import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import type { FileObjectStorage, StoredObjectBody } from "@/types/filesystem/storage";
import type {
  ImageThumbnailGenerator,
  ThumbnailPreparer,
  ThumbnailUseCases,
} from "@/types/filesystem/thumbnail";

export class ThumbnailService implements ThumbnailUseCases, ThumbnailPreparer {
  constructor(
    private readonly repository: FilesystemQueryRepository,
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

    return this.generateAndStore(source.objectKey, thumbnailKey);
  }

  async prepareThumbnail(entryId: string): Promise<void> {
    const source = await this.requireSource(entryId);
    const thumbnailKey = thumbnailObjectKey(source.fileId);
    const cached = await this.storage.get(thumbnailKey);
    if (cached) {
      await cached.body.cancel();
      return;
    }
    await this.generateAndStore(source.objectKey, thumbnailKey);
  }

  private async generateAndStore(
    sourceKey: string,
    thumbnailKey: string,
  ): Promise<StoredObjectBody> {
    const original = await this.storage.get(sourceKey);
    if (!original) {
      throw new AppError(FILE_ERRORS.FILE_CONTENT_NOT_FOUND);
    }

    try {
      const generated = await this.generator.generate(original.body);
      if (generated.contentType !== THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE) {
        throw new Error(THUMBNAIL_ERRORS.GENERATION_FAILED.code);
      }
      const stored = await this.storage.put(
        thumbnailKey,
        generated.body,
        generated.contentType,
      );
      return {
        ...stored,
        body: new Blob([generated.body]).stream(),
        contentType: generated.contentType,
      };
    } catch {
      throw new AppError(THUMBNAIL_ERRORS.GENERATION_FAILED);
    }
  }

  private async requireSource(entryId: string): Promise<{
    readonly fileId: string;
    readonly objectKey: string;
  }> {
    const entry = await this.repository.findEntryWithinRoots(
      entryId,
      FILESYSTEM_SYSTEM_ROOT_IDS,
    );
    if (
      !entry ||
      entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      entry.fileStatus !== FILE_STATUS.READY ||
      !entry.fileId ||
      !entry.objectKey ||
      entry.contentType === null ||
      entry.size === null
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
}
