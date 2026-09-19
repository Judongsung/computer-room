import type { SearchDirectory } from "@client/types/filesystem/search/search";
import { useRef } from "react";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MobileFileSelection } from "@client/components/mobile/filesystem/manage/mobile-file-selection";
import { MobileFileDialogs } from "@client/components/mobile/filesystem/manage/mobile-file-dialogs";
import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { useMobileFileActions, type MobileNavigationGuard } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileDirectoryContent } from "@client/components/mobile/filesystem/mobile-directory-content";
import { MobileDirectoryMenu } from "@client/components/mobile/filesystem/mobile-directory-menu";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
const EMPTY_ENTRIES: readonly FilesystemEntry[] = [];

interface MobileDirectoryProps {
  readonly directoryId: string;
  readonly title: string;
  readonly revision: number;
  readonly menuOpen: boolean;
  readonly gateway: FilesystemGateway;
  readonly onUpload: (files: FileList, directoryId: string) => void;
  readonly onGuardChange: (guard: MobileNavigationGuard) => void;
  readonly onCloseMenu: () => void;
  readonly onSearch: (directory: SearchDirectory) => void;
  readonly onRefresh: () => void;
  readonly onChanged: () => void;
  readonly onOpenDirectory: (id: string, title: string) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
}

export function MobileDirectory({
  directoryId,
  title,
  revision,
  menuOpen,
  gateway,
  onCloseMenu,
  onSearch,
  onRefresh,
  onChanged,
  onOpenDirectory,
  onOpenEntry,
  onUpload,
  onGuardChange,
}: MobileDirectoryProps) {
  const {
    page,
    isInitialLoading: loading,
    isLoadingMore: loadingMore,
    error,
    loadMore,
    isRefreshing,
    retry,
    reset,
  } = usePaginatedDirectory({
    gateway,
    directoryId,
    revision,
    errorFallback: MOBILE_COPY.LOAD_FAILED,
  });
  const actions = useMobileFileActions({ gateway, location: directoryId,
    entries: page?.items ?? EMPTY_ENTRIES, onChanged, onGuardChange });
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = loading || loadingMore || isRefreshing || actions.mutation.busy;

  return (
    <>
      <MobileActivity title={page?.directory.name ?? title}>
        {actions.mutation.error && !actions.dialog ? <p role="alert">{actions.mutation.error}</p> : null}
        {actions.selecting ? <>
          <FilesystemScrollRetention location={directoryId} scope={gateway} />
          <MobileFileSelection actions={actions} entries={page?.items ?? EMPTY_ENTRIES} gateway={gateway} busy={busy} />
          {error ? <p role="alert">{error}<button type="button" disabled={busy} onClick={() => void retry()}>{FILESYSTEM_COPY.RETRY}</button></p> : null}
          {page?.nextOffset != null ? <button type="button" disabled={busy} onClick={() => void loadMore()}>{FILESYSTEM_COPY.LOAD_MORE}</button> : null}
        </> : <MobileDirectoryContent
          directoryId={directoryId}
          page={page}
          loading={loading}
          loadingMore={loadingMore || isRefreshing}
          error={error}
          emptyLabel={MOBILE_COPY.EMPTY_DIRECTORY}
          gateway={gateway}
          onOpenDirectory={onOpenDirectory}
          onOpenEntry={onOpenEntry}
          onRetry={() => void retry()}
          onLoadMore={() => void loadMore()}
        />}
      </MobileActivity>
      <MobileDirectoryMenu
        onGuardChange={actions.setDialogGuard}
        onSearch={() => {
          if (page) onSearch(page.directory);
        }}
        directoryId={directoryId}
        page={page}
        busy={busy}
        selecting={actions.selecting}
        onSelect={actions.startSelection}
        onCreate={() => actions.openDialog("create")}
        onUpload={() => fileInput.current?.click()}
        open={menuOpen}
        gateway={gateway}
        onClose={onCloseMenu}
        onRefresh={onRefresh}
        onSortChanged={() => {
          reset();
          onRefresh();
        }}
      />
      <input ref={fileInput} className="visually-hidden" type="file" multiple disabled={busy || actions.selecting}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length && !busy && !actions.selecting) onUpload(files, directoryId);
          event.target.value = "";
        }} />
      <MobileFileDialogs actions={actions} gateway={gateway} location={directoryId} />
    </>
  );
}
