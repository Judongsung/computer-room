import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import {
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import { normalizeByteRange } from "@/domain/filesystem/byte-range";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { normalizeContentType } from "@/domain/filesystem/file-name";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type {
  FilesystemDownload,
  FilesystemContent,
  FilesystemEntryRecord,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "@/types/filesystem/filesystem";
import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type {
  DesktopEntryOrderRepository,
  FileRepository,
} from "@/types/filesystem/repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type { RequestedByteRange } from "@/types/filesystem/media";
import type { FileObjectStorage } from "@/types/filesystem/storage";
import type {
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
  FilesystemNameAllocator as FilesystemNameAllocatorPort,
} from "@/types/filesystem/policies/filesystem-policies";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";
import { FILE_UPLOAD_COMPENSATION_STEP } from "@/constants/filesystem/observability";
import type {
  FileUploadCompensationFailure,
  FileUploadCompensationObserver,
} from "@/types/filesystem/observability/file-upload-compensation";

export class FileService implements FileTransferUseCases {
  constructor(
    private readonly repository: FileRepository & DesktopEntryOrderRepository,
    private readonly storage: FileObjectStorage,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly compensationObserver: FileUploadCompensationObserver,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(repository),
    private readonly names: FilesystemNameAllocatorPort =
      new FilesystemNameAllocator(repository),
  ) {}

  async uploadFile(
    input: UploadFilesystemFileInput,
  ): Promise<FilesystemFileEntry> {
    this.assertFileSize(input.declaredSize);
    if (input.declaredSize > 0 && input.body === null) {
      throw new AppError(FILE_ERRORS.MISSING_FILE_BODY);
    }

    const parentId = input.parentId ?? FILESYSTEM_ROOT_ID.DOCUMENTS;
    await this.requireActiveDirectory(parentId);
    const name = await this.names.allocate(parentId, input.originalName);
    const id = this.idGenerator.generate();
    const createdAt = this.clock.now();
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${id}`;
    const contentType = normalizeContentType(input.contentType);
    const desktopOrder = await nextDesktopOrder(
      this.repository,
      parentId,
      input.desktopPlacement,
    );

    await this.repository.insertPendingFile({
      entry: {
        id,
        parentId,
        name,
        nameKey: filesystemNameKey(name),
        createdAt,
        ...(desktopOrder === undefined ? {} : { desktopOrder }),
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
      const cleanupResults = await Promise.allSettled([
        this.storage.delete(objectKey),
        this.repository.deleteFileMetadata(id),
      ]);
      const failures = compensationFailures(cleanupResults);
      if (failures.length > 0) {
        this.compensationObserver.report({ entryId: id, failures });
      }
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
    await this.activeEntries.requireDirectory(id, {
      notFound: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
    });
  }

  private async requireReadyFile(
    id: string,
  ): Promise<{ entry: FilesystemFileEntry; objectKey: string }> {
    const storedEntry = await this.activeEntries.find(id);
    if (
      !storedEntry ||
      storedEntry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      storedEntry.fileStatus !== FILE_STATUS.READY ||
      !storedEntry.objectKey
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

function compensationFailures(
  results: readonly [
    PromiseSettledResult<void>,
    PromiseSettledResult<void>,
  ],
): FileUploadCompensationFailure[] {
  const [objectCleanup, metadataCleanup] = results;
  return [
    ...(objectCleanup.status === "rejected"
      ? [
          {
            step: FILE_UPLOAD_COMPENSATION_STEP.OBJECT_STORAGE_DELETE,
            cause: objectCleanup.reason,
          },
        ]
      : []),
    ...(metadataCleanup.status === "rejected"
      ? [
          {
            step: FILE_UPLOAD_COMPENSATION_STEP.FILE_METADATA_DELETE,
            cause: metadataCleanup.reason,
          },
        ]
      : []),
  ];
}
