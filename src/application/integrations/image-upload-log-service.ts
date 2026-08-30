import {
  IMAGE_UPLOAD_LOG_LIMITS,
  IMAGE_UPLOAD_LOG_OUTCOME,
  IMAGE_UPLOAD_LOG_PAGE_LIMIT,
} from "@/constants/integrations/image-upload-log";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { HTTP_STATUS } from "@/constants/platform/http";
import { normalizeContentType } from "@/domain/filesystem/file-name";
import { mediaContentTypeBase } from "@/domain/filesystem/media-type";
import {
  encodeImageUploadLogCursor,
  imageUploadLogRetentionCutoff,
} from "@/domain/integrations/image-upload-log";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import type { ActiveFilesystemEntryResolver } from "@/types/filesystem/policies/filesystem-policies";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type {
  ImageUploadLog,
  ImageUploadLogQuery,
  ImageUploadLogRepository,
  ImageUploadLogUseCases,
  RecordImageUploadLogInput,
  StoredImageUploadLog,
} from "@/types/integrations/image-upload-log";
import type { Clock, IdGenerator } from "@/types/platform/runtime";

export class ImageUploadLogService implements ImageUploadLogUseCases {
  constructor(
    private readonly logs: ImageUploadLogRepository,
    private readonly activeEntries: ActiveFilesystemEntryResolver,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  record(input: RecordImageUploadLogInput): Promise<void> {
    const base = {
      id: this.ids.generate(),
      profileId: input.profileId,
      outcome: input.outcome,
      contentType: normalizedLogContentType(input.contentType),
      declaredSize: input.declaredSize,
      receivedAt: input.receivedAt,
      durationMs: Math.max(0, Math.trunc(input.durationMs)),
    } as const;
    const stored: StoredImageUploadLog =
      input.outcome === IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS
        ? {
            ...base,
            fileEntryId: input.file.id,
            fileName: input.file.name,
            httpStatus: HTTP_STATUS.CREATED,
            errorCode: null,
            errorMessage: null,
          }
        : {
            ...base,
            fileEntryId: null,
            fileName: null,
            httpStatus: input.error.status,
            errorCode: input.error.code.slice(
              0,
              IMAGE_UPLOAD_LOG_LIMITS.ERROR_CODE_MAX_LENGTH,
            ),
            errorMessage: input.error.message.slice(
              0,
              IMAGE_UPLOAD_LOG_LIMITS.ERROR_MESSAGE_MAX_LENGTH,
            ),
          };
    return this.logs.insert(stored);
  }

  async listLogs(query: ImageUploadLogQuery) {
    const stored = await this.logs.list({
      ...query,
      cutoff: imageUploadLogRetentionCutoff(this.clock.now()),
      limit: IMAGE_UPLOAD_LOG_PAGE_LIMIT + 1,
    });
    const hasMore = stored.length > IMAGE_UPLOAD_LOG_PAGE_LIMIT;
    const page = stored.slice(0, IMAGE_UPLOAD_LOG_PAGE_LIMIT);
    const activeFiles = await this.activeEntries.findMany(
      page.flatMap((log) => (log.fileEntryId ? [log.fileEntryId] : [])),
    );
    const filesById = new Map<string, FilesystemFileEntry>();
    for (const entry of activeFiles) {
      if (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) continue;
      const file = toPublicEntry(entry);
      if (file.kind === FILESYSTEM_ENTRY_KIND.FILE) {
        filesById.set(file.id, file);
      }
    }
    const last = page.at(-1);
    return {
      items: page.map((log) => toPublicLog(log, filesById)),
      nextCursor:
        hasMore && last
          ? encodeImageUploadLogCursor({
              receivedAt: last.receivedAt,
              id: last.id,
            })
          : null,
    };
  }

  purgeExpired(referenceTime: number): Promise<number> {
    return purgeExpiredImageUploadLogs(this.logs, referenceTime);
  }
}

export function purgeExpiredImageUploadLogs(
  logs: Pick<ImageUploadLogRepository, "purgeBefore">,
  referenceTime: number,
): Promise<number> {
  return logs.purgeBefore(imageUploadLogRetentionCutoff(referenceTime));
}

function toPublicLog(
  log: StoredImageUploadLog,
  filesById: ReadonlyMap<string, FilesystemFileEntry>,
): ImageUploadLog {
  return {
    id: log.id,
    profileId: log.profileId,
    outcome: log.outcome,
    contentType: log.contentType,
    declaredSize: log.declaredSize,
    fileName: log.fileName,
    file: log.fileEntryId ? (filesById.get(log.fileEntryId) ?? null) : null,
    httpStatus: log.httpStatus,
    error:
      log.errorCode && log.errorMessage
        ? { code: log.errorCode, message: log.errorMessage }
        : null,
    receivedAt: new Date(log.receivedAt).toISOString(),
    durationMs: log.durationMs,
  };
}

function normalizedLogContentType(value: string | null): string | null {
  if (value === null) return null;
  try {
    return mediaContentTypeBase(normalizeContentType(value)).slice(
      0,
      IMAGE_UPLOAD_LOG_LIMITS.CONTENT_TYPE_MAX_LENGTH,
    );
  } catch {
    return null;
  }
}
