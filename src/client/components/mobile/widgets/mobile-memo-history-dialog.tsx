import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MemoHistoryContent } from "@client/components/widgets/memo/memo-history-content";
import { MEMO_HISTORY_COPY as COPY } from "@client/content/ko/widgets/memo-history";
import { useMemoHistory } from "@client/hooks/widgets/memo/use-memo-history";
import type { MemoHistoryGateway } from "@client/types/widgets/ports/memo";

interface MobileMemoHistoryDialogProps {
  readonly widgetId: string;
  readonly gateway: MemoHistoryGateway;
  readonly onClose: () => void;
  readonly onLoadDraft: (markdown: string) => boolean;
}

export function MobileMemoHistoryDialog({
  widgetId,
  gateway,
  onClose,
  onLoadDraft,
}: MobileMemoHistoryDialogProps) {
  const history = useMemoHistory(widgetId, gateway);
  const canLoad = history.detail !== null && history.detail.version === history.selectedVersion && !history.detailLoading;
  const loadDraft = () => {
    if (canLoad && history.detail && onLoadDraft(history.detail.markdown)) onClose();
  };

  return (
    <MobileDialog title={COPY.TITLE} actions={<>
      <button type="button" disabled={!canLoad} onClick={loadDraft}>{COPY.LOAD_DRAFT}</button>
      <button type="button" onClick={onClose}>{COPY.CLOSE}</button>
    </>}>
      <MemoHistoryContent history={history} />
    </MobileDialog>
  );
}
