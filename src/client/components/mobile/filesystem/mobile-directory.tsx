import type { SearchDirectory } from "@client/types/filesystem/search/search";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileDirectoryContent } from "@client/components/mobile/filesystem/mobile-directory-content";
import { MobileDirectoryMenu } from "@client/components/mobile/filesystem/mobile-directory-menu";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";

type MobileDirectoryGateway = FilesystemDirectoryGateway &
  Pick<FilesystemContentGateway, "thumbnailUrl">;

interface MobileDirectoryProps {
  readonly directoryId: string;
  readonly title: string;
  readonly revision: number;
  readonly menuOpen: boolean;
  readonly gateway: MobileDirectoryGateway;
  readonly onCloseMenu: () => void;
  readonly onSearch: (directory: SearchDirectory) => void;
  readonly onRefresh: () => void;
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
  onOpenDirectory,
  onOpenEntry,
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

  return (
    <>
      <MobileActivity title={page?.directory.name ?? title}>
        <MobileDirectoryContent
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
        />
      </MobileActivity>
      <MobileDirectoryMenu
        onSearch={() => {
          if (page) onSearch(page.directory);
        }}
        directoryId={directoryId}
        page={page}
        busy={loading || loadingMore || isRefreshing}
        open={menuOpen}
        gateway={gateway}
        onClose={onCloseMenu}
        onRefresh={onRefresh}
        onSortChanged={() => {
          reset();
          onRefresh();
        }}
      />
    </>
  );
}
