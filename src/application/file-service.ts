import { FILE_ERRORS } from "../constants/errors/file";
import {
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "../constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { AppError } from "../domain/errors";
import { normalizeByteRange } from "../domain/byte-range";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "../domain/filesystem-name";
import { normalizeContentType } from "../domain/file-name";
import { mediaKindFromContentType } from "../domain/media-type";
import type { FilePage, PublicFile } from "../types/file";
import type {
  FilesystemDownload,
  FilesystemContent,
  FilesystemEntryRecord,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "../types/filesystem";
import type { FileUseCases } from "../types/file-service";
import type { FilesystemRepository } from "../types/repository";
import type { Clock, IdGenerator } from "../types/runtime";
import type { RequestedByteRange } from "../types/media";
import type { FileObjectStorage } from "../types/storage";
import { toPublicEntry } from "./filesystem-service";

export class FileService implements FileUseCases {
  constructor(
    private readonly repository: FilesystemRepository,
    private readonly storage: FileObjectStorage,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listFiles(offset: number, limit: number): Promise<FilePage> {
    const files = await this.repository.listActiveFiles(offset, limit + 1);
    const hasMore = files.length > limit;
    return {
      items: files.slice(0, limit).map(toLegacyPublicFile),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async uploadFile(
    input: UploadFilesystemFileInput,
  ): Promise<FilesystemFileEntry> {
    this.assertFileSize(input.declaredSize);
    if (input.declaredSize > 0 && input.body === null) {
      throw new AppError(FILE_ERRORS.MISSING_FILE_BODY);
    }

    const parentId = input.parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS;
    await this.requireActiveDirectory(parentId);
    const requestedName = normalizeFilesystemName(input.originalName);
    const occupied = new Set(await this.repository.listNameKeys(parentId));
    const name = availableFilesystemName(requestedName, occupied);
    const id = this.idGenerator.generate();
    const createdAt = this.clock.now();
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${id}`;
    const contentType = normalizeContentType(input.contentType);

    await this.repository.insertPendingFile({
      entry: {
        id,
        parentId,
        name,
        nameKey: filesystemNameKey(name),
        createdAt,
      },
      objectKey,
      contentType,
      size: input.declaredSize,
    });

    try {
      const storedObject = await this.storage.put(
        objectKey,
        input.body,
        contentType,
      );
      if (storedObject.size !== input.declaredSize) {
        throw new AppError(FILE_ERRORS.FILE_SIZE_MISMATCH);
      }
      this.assertFileSize(storedObject.size);
      await this.repository.markFileReady(id, storedObject.size, storedObject.etag);
      const storedEntry = await this.repository.findEntry(id);
      if (!storedEntry) {
        throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
      }
      const entry = toPublicEntry({
        ...storedEntry,
        fileStatus: FILE_STATUS.READY,
        size: storedObject.size,
        etag: storedObject.etag,
      });
      if (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) {
        throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
      }
      return entry;
    } catch (error) {
      await Promise.allSettled([
        this.storage.delete(objectKey),
        this.repository.deleteFileMetadata(id),
      ]);
      throw error;
    }
  }

  async downloadFile(id: string): Promise<FilesystemDownload> {
    const { entry, objectKey } = await this.requireReadyFile(id);
    const object = await this.storage.get(objectKey);
    if (!object) {
      throw new AppError(FILE_ERRORS.FILE_CONTENT_NOT_FOUND);
    }
    return { entry, object };
  }

  async streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent> {
    const { entry, objectKey } = await this.requireReadyFile(id);
    if (!mediaKindFromContentType(entry.contentType)) {
      throw new AppError(FILE_ERRORS.UNSUPPORTED_MEDIA_TYPE);
    }
    const range = requestedRange
      ? normalizeByteRange(requestedRange, entry.size)
      : null;
    const object = await this.storage.get(objectKey, range ?? undefined);
    if (!object) {
      throw new AppError(FILE_ERRORS.FILE_CONTENT_NOT_FOUND);
    }
    return { entry, object, range };
  }

  private async requireActiveDirectory(id: string): Promise<void> {
    const entry = await this.repository.findEntry(id);
    if (
      !entry ||
      entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY ||
      !(await this.repository.isWithinRoot(id, FILESYSTEM_ROOT_ID.DOCUMENTS))
    ) {
      throw new AppError(FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND);
    }
  }

  private async requireReadyFile(
    id: string,
  ): Promise<{ entry: FilesystemFileEntry; objectKey: string }> {
    const storedEntry = await this.repository.findEntry(id);
    if (
      !storedEntry ||
      storedEntry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      storedEntry.fileStatus !== FILE_STATUS.READY ||
      !storedEntry.objectKey ||
      !(await this.repository.isWithinRoot(id, FILESYSTEM_ROOT_ID.DOCUMENTS))
    ) {
      throw new AppError(FILE_ERRORS.FILE_NOT_FOUND);
    }
    const entry = toPublicEntry(storedEntry);
    if (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return { entry, objectKey: storedEntry.objectKey };
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

function toLegacyPublicFile(entry: FilesystemEntryRecord): PublicFile {
  const publicEntry = toPublicEntry(entry);
  if (publicEntry.kind !== FILESYSTEM_ENTRY_KIND.FILE) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: publicEntry.id,
    name: publicEntry.name,
    contentType: publicEntry.contentType,
    size: publicEntry.size,
    createdAt: publicEntry.createdAt,
  };
}
