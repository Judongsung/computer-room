import type {
  FileUploadCompensationFailureEvent,
  FileUploadCompensationObserver,
} from "@/types/filesystem/observability/file-upload-compensation";

export const NOOP_FILE_UPLOAD_COMPENSATION_OBSERVER = {
  report() {},
} satisfies FileUploadCompensationObserver;

export class RecordingFileUploadCompensationObserver
  implements FileUploadCompensationObserver
{
  readonly events: FileUploadCompensationFailureEvent[] = [];

  report(event: FileUploadCompensationFailureEvent): void {
    this.events.push({
      entryId: event.entryId,
      failures: [...event.failures],
    });
  }
}
