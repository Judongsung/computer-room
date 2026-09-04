import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import type { DownloadConfirmationProps } from "@client/types/filesystem/text/files";

export function DesktopDownloadConfirmation({ file, onConfirm, onCancel }: DownloadConfirmationProps) {
  return (
    <ConfirmDialog
      title={NOTEPAD_COPY.DOWNLOAD_TITLE}
      message={NOTEPAD_COPY.DOWNLOAD_CONFIRM(file.name)}
      busy={false}
      confirmLabel={NOTEPAD_COPY.DOWNLOAD}
      cancelLabel={NOTEPAD_COPY.CANCEL}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
