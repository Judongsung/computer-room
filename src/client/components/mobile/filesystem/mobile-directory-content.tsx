import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";
import { formatFileSize } from "@client/utils/format-file-size";

interface MobileDirectoryContentProps {
  readonly directoryId: string;
  readonly page: FilesystemDirectoryPage | null;
  readonly loading: boolean;
  readonly loadingMore: boolean;
  readonly error: string | null;
  readonly emptyLabel: string;
  readonly gateway: Pick<FilesystemContentGateway, "thumbnailUrl">;
  readonly onOpenDirectory: (id: string, title: string) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onRetry: () => void;
  readonly onLoadMore: () => void;
}

export function MobileDirectoryContent({
  page,
  directoryId,
  loading,
  loadingMore,
  error,
  emptyLabel,
  gateway,
  onOpenDirectory,
  onOpenEntry,
  onLoadMore,
  onRetry,
}: MobileDirectoryContentProps) {
  return (
    <>
      <FilesystemScrollRetention location={`${directoryId}:${page?.sort.field ?? ""}:${page?.sort.direction ?? ""}`} scope={gateway} />
      {page ? (
        <nav
          className={MOBILE_CLASS_NAME.BREADCRUMBS}
          aria-label={MOBILE_COPY.CURRENT_PATH}
        >
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
      {loading && !page ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
      ) : null}
      {error ? (
        <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
          {error}
        </p>
      ) : null}
      {error ? (
        <button
          type="button"
          disabled={loadingMore || loading}
          onClick={onRetry}
        >
          {FILESYSTEM_COPY.RETRY}
        </button>
      ) : null}
      {page?.items.length === 0 ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{emptyLabel}</p>
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
        <button type="button" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
        </button>
      ) : null}
    </>
  );
}
