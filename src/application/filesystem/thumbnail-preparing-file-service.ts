import { isThumbnailSourceSupported } from "@/domain/filesystem/thumbnail";
import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";
import type { FilePage } from "@/types/filesystem/file";
import type { FileUseCases } from "@/types/filesystem/file-service";
import type {
  FilesystemContent,
  FilesystemDownload,
  FilesystemFileEntry,
  UploadFilesystemFileInput,
} from "@/types/filesystem/filesystem";
import type { RequestedByteRange } from "@/types/filesystem/media";
import type { BackgroundTaskScheduler } from "@/types/platform/runtime";
import type { ThumbnailPreparer } from "@/types/filesystem/thumbnail";

export class ThumbnailPreparingFileService implements FileUseCases {
  constructor(
    private readonly files: FileUseCases,
    private readonly thumbnails: ThumbnailPreparer,
    private readonly backgroundTasks: BackgroundTaskScheduler,
  ) {}

  listFiles(offset: number, limit: number): Promise<FilePage> {
    return this.files.listFiles(offset, limit);
  }

  async uploadFile(
    input: UploadFilesystemFileInput,
  ): Promise<FilesystemFileEntry> {
    const entry = await this.files.uploadFile(input);
    if (isThumbnailSourceSupported(entry.contentType, entry.size)) {
      this.backgroundTasks.schedule(
        this.thumbnails.prepareThumbnail(entry.id),
        BACKGROUND_TASK_FAILURE_CODE.THUMBNAIL_PREPARATION,
      );
    }
    return entry;
  }

  downloadFile(id: string): Promise<FilesystemDownload> {
    return this.files.downloadFile(id);
  }

  streamFile(
    id: string,
    requestedRange?: RequestedByteRange,
  ): Promise<FilesystemContent> {
    return this.files.streamFile(id, requestedRange);
  }
}
