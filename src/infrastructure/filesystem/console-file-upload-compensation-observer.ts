import {
  FILE_UPLOAD_COMPENSATION_LOG_EVENT,
} from "@/constants/filesystem/observability";
import type {
  FileUploadCompensationFailureEvent,
  FileUploadCompensationObserver,
} from "@/types/filesystem/observability/file-upload-compensation";

export class ConsoleFileUploadCompensationObserver
  implements FileUploadCompensationObserver
{
  report(event: FileUploadCompensationFailureEvent): void {
    console.error(
      JSON.stringify({
        event: FILE_UPLOAD_COMPENSATION_LOG_EVENT,
        entryId: event.entryId,
        failures: event.failures.map(({ step, cause }) => ({
          step,
          errorType: errorType(cause),
        })),
      }),
    );
  }
}

function errorType(cause: unknown): string {
  return cause instanceof Error ? cause.name : typeof cause;
}
