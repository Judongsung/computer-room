import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import type { DownloadConfirmationProps } from "@client/types/filesystem/text/files";

export function MobileDownloadConfirmation({ file, onConfirm, onCancel }: DownloadConfirmationProps) {
  return (
    <MobileDialog title={NOTEPAD_COPY.DOWNLOAD_TITLE} actions={<>
      <button type="button" onClick={onConfirm}>{NOTEPAD_COPY.DOWNLOAD}</button>
      <button type="button" onClick={onCancel}>{NOTEPAD_COPY.CANCEL}</button>
    </>}>
      <p>{NOTEPAD_COPY.DOWNLOAD_CONFIRM(file.name)}</p>
    </MobileDialog>
  );
}
