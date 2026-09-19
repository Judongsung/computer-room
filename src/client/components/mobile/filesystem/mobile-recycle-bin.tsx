import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { useMemo } from "react";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { MobileMenu } from "@client/components/mobile/shared/mobile-menu";
import { MobileFileSelection } from "@client/components/mobile/filesystem/manage/mobile-file-selection";
import { MobileFileDialogs } from "@client/components/mobile/filesystem/manage/mobile-file-dialogs";
import { useMobileFileActions, type MobileNavigationGuard } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
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
  readonly menuOpen: boolean;
  readonly onCloseMenu: () => void;
  readonly onRefresh: () => void;
  readonly onChanged: () => void;
  readonly onGuardChange: (guard: MobileNavigationGuard) => void;
}

export function MobileRecycleBin({ gateway, revision, menuOpen, onCloseMenu, onRefresh, onChanged, onGuardChange }: MobileRecycleBinProps) {
  const { page, error, isLoadingMore: loadingMore, isRefreshing, loadMore, retry } = usePaginatedTrash({
    gateway, revision, errorFallback: MOBILE_COPY.LOAD_FAILED,
  });

  const entries = useMemo(() => page?.items.map((item) => item.entry) ?? [], [page]);
  const actions = useMobileFileActions({ gateway, location: "trash", entries, onChanged, onGuardChange });
  const busy = loadingMore || isRefreshing || actions.mutation.busy;
  const restoreBlocked = page?.items.some((item) => actions.selection.selectedIds.has(item.entry.id) && item.deletionStartedAt !== null) ?? false;
  return (
    <>
    <MobileActivity title={MOBILE_COPY.RECYCLE_BIN}>
      <FilesystemScrollRetention location="trash" scope={gateway} />
      {!page && !error ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      {actions.mutation.error && !actions.dialog ? <p role="alert">{actions.mutation.error}</p> : null}
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
      {actions.selecting ? <MobileFileSelection actions={actions} entries={entries} gateway={gateway} busy={busy} trash restoreBlocked={restoreBlocked}
        metadata={(entry) => page?.items.find((item) => item.entry.id === entry.id)?.deletionStartedAt != null
          ? <small>{FILESYSTEM_COPY.DELETION_INCOMPLETE}</small> : null} /> : page?.items.length ? (
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
        <button type="button" disabled={busy} onClick={() => void loadMore()}>
          {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
        </button>
      ) : null}
    </MobileActivity>
    <MobileMenu open={menuOpen} onClose={onCloseMenu}>
      <button type="button" disabled={busy} onClick={onRefresh}>{FILESYSTEM_COPY.REFRESH}</button>
      <button type="button" disabled={busy || !entries.length || actions.selecting} onClick={() => { onCloseMenu(); actions.startSelection(); }}>{MOBILE_FILESYSTEM_COPY.SELECT}</button>
      <button type="button" disabled={busy || !entries.length} onClick={() => { onCloseMenu(); actions.openDialog("empty"); }}>{FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}</button>
    </MobileMenu>
    <MobileFileDialogs actions={actions} gateway={gateway} location="trash" />
    </>
  );
}
