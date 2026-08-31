import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { GuestGateway } from "@client/types/guest/guest";
import { formatFileSize } from "@client/utils/format-file-size";

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
      {page ? (
        <nav className={MOBILE_CLASS_NAME.BREADCRUMBS} aria-label={MOBILE_COPY.CURRENT_PATH}>
          {page.breadcrumbs.map((breadcrumb, index) => (
            <span key={breadcrumb.id}>
              {index > 0 ? "›" : null}
              <button
                type="button"
                onClick={() => onOpenDirectory(breadcrumb.id, breadcrumb.name)}
              >
                {breadcrumb.name}
              </button>
            </span>
          ))}
        </nav>
      ) : null}
      {query.isInitialLoading && !page ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
      ) : null}
      {query.error ? (
        <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{query.error}</p>
      ) : null}
      {page?.items.length === 0 ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{GUEST_COPY.EMPTY_DIRECTORY}</p>
      ) : null}
      {page?.items.length ? (
        <ul className={MOBILE_CLASS_NAME.LIST}>
          {page.items.map((entry) => (
            <li key={entry.id}>
              <button
                className={MOBILE_CLASS_NAME.LIST_ITEM}
                type="button"
                onClick={() =>
                  entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
                    ? onOpenDirectory(entry.id, entry.name)
                    : onOpenEntry(entry)
                }
              >
                <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                  <MobileEntryIcon entry={entry} gateway={gateway} />
                </span>
                <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                  <strong>{entry.name}</strong>
                  <small className={MOBILE_CLASS_NAME.LIST_META}>
                    {entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
                      ? MOBILE_COPY.DIRECTORY_KIND
                      : entry.kind === FILESYSTEM_ENTRY_KIND.FILE
                        ? `${entry.contentType} · ${formatFileSize(entry.size)}`
                        : MOBILE_COPY.WIDGET_KIND}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextOffset !== null && page?.nextOffset !== undefined ? (
        <button
          type="button"
          disabled={query.isLoadingMore}
          onClick={() => void query.loadMore()}
        >
          {query.isLoadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
        </button>
      ) : null}
    </MobileActivity>
  );
}
