import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileDirectoryContent } from "@client/components/mobile/filesystem/mobile-directory-content";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { GuestGateway } from "@client/types/guest/guest";

interface GuestMobileDirectoryProps {
  readonly directoryId: string;
  readonly title: string;
  readonly revision: number;
  readonly gateway: GuestGateway;
  readonly onOpenDirectory: (id: string, title: string) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
}

export function GuestMobileDirectory({
  directoryId,
  title,
  revision,
  gateway,
  onOpenDirectory,
  onOpenEntry,
}: GuestMobileDirectoryProps) {
  const query = usePaginatedDirectory({
    gateway,
    directoryId,
    revision,
    errorFallback: GUEST_COPY.LOAD_FAILED,
  });
  const page = query.page;
  return (
    <MobileActivity title={page?.directory.name ?? title}>
      <MobileDirectoryContent
        page={page}
        loading={query.isInitialLoading}
        loadingMore={query.isLoadingMore}
        error={query.error}
        emptyLabel={GUEST_COPY.EMPTY_DIRECTORY}
        gateway={gateway}
        onOpenDirectory={onOpenDirectory}
        onOpenEntry={onOpenEntry}
        onLoadMore={() => void query.loadMore()}
      />
    </MobileActivity>
  );
}
