import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { DesktopModal } from "@client/components/desktop/desktop-modal";
import { MemoHistoryContent } from "@client/components/widgets/memo/memo-history-content";
import { MEMO_HISTORY_COPY as COPY } from "@client/content/ko/widgets/memo-history";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { useMemoHistory } from "@client/hooks/widgets/memo/use-memo-history";
import type { MemoHistoryGateway } from "@client/types/widgets/ports/memo";

interface DesktopMemoHistoryDialogProps {
  readonly widgetId: string;
  readonly gateway: MemoHistoryGateway;
  readonly onClose: () => void;
  readonly onLoadDraft: (markdown: string) => boolean;
}

export function DesktopMemoHistoryDialog({
  widgetId,
  gateway,
  onClose,
  onLoadDraft,
}: DesktopMemoHistoryDialogProps) {
  const history = useMemoHistory(widgetId, gateway);
  const canLoad = history.detail !== null && history.detail.version === history.selectedVersion && !history.detailLoading;
  const loadDraft = () => {
    if (canLoad && history.detail && onLoadDraft(history.detail.markdown)) onClose();
  };

  return (
    <DesktopModal
      title={COPY.TITLE}
      iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.MEMO]}
      windowClassName="desktop-memo-history"
      closeOnBackdrop
      onRequestClose={onClose}
      footer={
        <footer className="desktop-history-footer">
          <button type="button" disabled={!canLoad} onClick={loadDraft}>{COPY.LOAD_DRAFT}</button>
          <button type="button" onClick={onClose}>{COPY.CLOSE}</button>
        </footer>
      }
    >
      <MemoHistoryContent history={history} />
    </DesktopModal>
  );
}
