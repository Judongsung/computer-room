import { AppError } from "../domain/errors";
import { FILE_ERRORS } from "../constants/errors/file";
import {
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "../constants/file";
import { normalizeContentType, normalizeFileName } from "../domain/file-name";
import type {
  FileDownload,
  FileMetadata,
  FilePage,
  PublicFile,
  UploadFileInput,
} from "../types/file";
import type { FileUseCases } from "../types/file-service";
import type { FileMetadataRepository } from "../types/repository";
import type { Clock, IdGenerator } from "../types/runtime";
import type { FileObjectStorage } from "../types/storage";

export class FileService implements FileUseCases {
  constructor(
    private readonly repository: FileMetadataRepository,
    private readonly storage: FileObjectStorage,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listFiles(offset: number, limit: number): Promise<FilePage> {
    const files = await this.repository.listReady(offset, limit + 1);
    const hasMore = files.length > limit;

    return {
      items: files.slice(0, limit).map(toPublicFile),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async uploadFile(input: UploadFileInput): Promise<PublicFile> {
    this.assertFileSize(input.declaredSize);

    if (input.declaredSize > 0 && input.body === null) {
      throw new AppError(FILE_ERRORS.MISSING_FILE_BODY);
    }

    const id = this.idGenerator.generate();
    const pendingFile: FileMetadata = {
      id,
      objectKey: `${FILE_OBJECT_KEY_PREFIX}/${id}`,
      originalName: normalizeFileName(input.originalName),
      contentType: normalizeContentType(input.contentType),
      size: input.declaredSize,
      etag: null,
      status: FILE_STATUS.PENDING,
      createdAt: this.clock.now(),
    };

    await this.repository.insertPending(pendingFile);

    try {
      const storedObject = await this.storage.put(
        pendingFile.objectKey,
        input.body,
        pendingFile.contentType,
      );

      if (storedObject.size !== input.declaredSize) {
        throw new AppError(FILE_ERRORS.FILE_SIZE_MISMATCH);
      }

      this.assertFileSize(storedObject.size);
      await this.repository.markReady(id, storedObject.size, storedObject.etag);

      return toPublicFile({
        ...pendingFile,
        size: storedObject.size,
        etag: storedObject.etag,
        status: FILE_STATUS.READY,
      });
    } catch (error) {
      await Promise.allSettled([
        this.storage.delete(pendingFile.objectKey),
        this.repository.delete(pendingFile.id),
      ]);
      throw error;
    }
  }

  async downloadFile(id: string): Promise<FileDownload> {
    const metadata = await this.requireReadyFile(id);
    const object = await this.storage.get(metadata.objectKey);

    if (!object) {
      throw new AppError(FILE_ERRORS.FILE_CONTENT_NOT_FOUND);
    }

    return { metadata, object };
  }

  async deleteFile(id: string): Promise<void> {
    const metadata = await this.requireReadyFile(id);
    await this.storage.delete(metadata.objectKey);
    await this.repository.delete(metadata.id);
  }

  private async requireReadyFile(id: string): Promise<FileMetadata> {
    const file = await this.repository.findReadyById(id);

    if (!file) {
      throw new AppError(FILE_ERRORS.FILE_NOT_FOUND);
    }

    return file;
  }

  private assertFileSize(size: number): void {
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new AppError(FILE_ERRORS.INVALID_FILE_SIZE);
    }

    if (size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(FILE_ERRORS.FILE_TOO_LARGE);
    }
  }
}

function toPublicFile(file: FileMetadata): PublicFile {
  return {
    id: file.id,
    name: file.originalName,
    contentType: file.contentType,
    size: file.size,
    createdAt: new Date(file.createdAt).toISOString(),
  };
}
