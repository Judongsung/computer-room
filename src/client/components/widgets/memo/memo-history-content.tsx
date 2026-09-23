import { MEMO_HISTORY_COPY as COPY, formatMemoVersionTime } from "@client/content/ko/widgets/memo-history";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import type { useMemoHistory } from "@client/hooks/widgets/memo/use-memo-history";

interface MemoHistoryContentProps {
  readonly history: ReturnType<typeof useMemoHistory>;
}

export function MemoHistoryContent({ history }: MemoHistoryContentProps) {
  return (
    <div className="memo-history-content">
      <div className="memo-history-list">
        {history.listLoading ? <p role="status">{COPY.LOADING}</p> : null}
        {history.listError ? <p role="alert">{history.listError}</p> : null}
        {history.listError ? (
          <button type="button" onClick={history.reloadList}>{COPY.RETRY}</button>
        ) : null}
        {!history.listLoading && !history.listError && history.items.length === 0 ? <p>{COPY.EMPTY}</p> : null}
        {history.items.length > 0 ? (
          <ol>
            {history.items.map((item) => (
              <li key={item.version}>
                <button type="button" aria-pressed={history.selectedVersion === item.version}
                  onClick={() => history.select(item.version)}>
                  <strong>{COPY.VERSION(item.version)}</strong>
                  <span>{formatMemoVersionTime(item.savedAt)}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      <div className="memo-history-preview">
        {history.detailLoading ? <p role="status">{COPY.DETAIL_LOADING}</p> : null}
        {history.detailError ? <p role="alert">{history.detailError}</p> : null}
        {history.detailError ? (
          <button type="button" onClick={history.expired ? history.reloadList : history.retryDetail}>
            {history.expired ? COPY.RELOAD_LIST : COPY.RETRY}
          </button>
        ) : null}
        {history.detail ? <MarkdownContent markdown={history.detail.markdown} /> : null}
      </div>
      <p className="memo-history-notice">{COPY.LOAD_NOTICE} {COPY.RETENTION_NOTICE}</p>
    </div>
  );
}
