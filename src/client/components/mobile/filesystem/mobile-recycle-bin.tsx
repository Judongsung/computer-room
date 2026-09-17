import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { UI_LOCALE } from "@client/content/ko/shared/format";
import { usePaginatedTrash } from "@client/hooks/filesystem/recycle/use-paginated-trash";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileRecycleBinProps {
  readonly gateway: FilesystemGateway;
  readonly revision: number;
}

export function MobileRecycleBin({ gateway, revision }: MobileRecycleBinProps) {
  const { page, error, isLoadingMore: loadingMore, isRefreshing, loadMore, retry } = usePaginatedTrash({
    gateway, revision, errorFallback: MOBILE_COPY.LOAD_FAILED,
  });

  return (
    <MobileActivity title={MOBILE_COPY.RECYCLE_BIN}>
      <FilesystemScrollRetention location="trash" scope={gateway} />
      {!page && !error ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      {error ? (
        <button
          type="button"
          onClick={() => void retry()}
        >
          {FILESYSTEM_COPY.RETRY}
        </button>
      ) : null}
      {page?.items.length === 0 ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.EMPTY_TRASH}</p>
      ) : null}
      {page?.items.length ? (
        <ul className={MOBILE_CLASS_NAME.LIST}>
          {page.items.map(({ entry, deletedAt, originalLocation, deletionStartedAt }) => (
            <li key={entry.id} className={MOBILE_CLASS_NAME.LIST_ITEM}>
              <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                <MobileEntryIcon entry={entry} gateway={gateway} />
              </span>
              <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                <strong>{entry.name}</strong>
                {deletionStartedAt !== null ? (
                  <small className={MOBILE_CLASS_NAME.LIST_META}>{FILESYSTEM_COPY.DELETION_INCOMPLETE}</small>
                ) : null}
                <small className={MOBILE_CLASS_NAME.LIST_META}>
                  {MOBILE_COPY.ORIGINAL_LOCATION}: {originalLocation}
                </small>
                <small className={MOBILE_CLASS_NAME.LIST_META}>
                  {MOBILE_COPY.DELETED_AT}: {new Date(deletedAt).toLocaleString(UI_LOCALE)}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextOffset !== null && page?.nextOffset !== undefined ? (
        <button type="button" disabled={loadingMore || isRefreshing} onClick={() => void loadMore()}>
          {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
        </button>
      ) : null}
    </MobileActivity>
  );
}
