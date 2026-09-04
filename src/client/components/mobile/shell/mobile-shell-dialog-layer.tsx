import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MobileDownloadConfirmation } from "@client/components/mobile/notepad/download-confirmation";
import type { MobileShellController } from "@client/types/app/mobile-shell";

interface MobileShellDialogLayerProps {
  readonly controller: MobileShellController;
}

export function MobileShellDialogLayer({
  controller,
}: MobileShellDialogLayerProps) {
  return (
    <>
      {controller.pendingDownload ? (
        <MobileDownloadConfirmation file={controller.pendingDownload} onConfirm={controller.confirmPendingDownload} onCancel={controller.cancelPendingDownload} />
      ) : null}
      {controller.draftConflictOpen ? (
        <MobileDialog
          title={MOBILE_COPY.DRAFT_EXISTS_TITLE}
          actions={
            <>
              <button type="button" onClick={controller.resumeDraftConflict}>
                {MOBILE_COPY.RESUME_DRAFT}
              </button>
              <button type="button" onClick={controller.discardConflictingDraft}>
                {MOBILE_COPY.DELETE_DRAFT}
              </button>
              <button type="button" onClick={controller.dismissDraftConflict}>
                {MOBILE_COPY.CANCEL}
              </button>
            </>
          }
        >
          <p>{MOBILE_COPY.DRAFT_EXISTS_MESSAGE}</p>
        </MobileDialog>
      ) : null}
      {controller.draftError ? (
        <MobileDialog
          title={MOBILE_COPY.APP_NAME}
          actions={
            <button type="button" onClick={controller.clearDraftError}>
              {MOBILE_COPY.CONFIRM}
            </button>
          }
        >
          <p>{controller.draftError}</p>
        </MobileDialog>
      ) : null}
    </>
  );
}
