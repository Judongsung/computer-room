import { useEffect, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { MobileDirectoryMenu } from "@client/components/mobile/filesystem/mobile-directory-menu";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { formatFileSize } from "@client/utils/format-file-size";
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
  onRefresh,
  onOpenDirectory,
  onOpenEntry,
}: MobileDirectoryProps) {
  const [page, setPage] = useState<FilesystemDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPage(null);
    setLoading(true);
    setError(null);
    void gateway.listDirectory(directoryId).then(
      (next) => {
        if (!active) return;
        setPage(next);
        setError(null);
        setLoading(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setError(errorMessage(caught, MOBILE_COPY.LOAD_FAILED));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [directoryId, gateway, revision]);

  const loadMore = async (): Promise<void> => {
    if (!page || page.nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await gateway.listDirectory(directoryId, page.nextOffset);
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch (caught) {
      setError(errorMessage(caught, MOBILE_COPY.LOAD_FAILED));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
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
        {loading && !page ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
        {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
        {page && page.items.length === 0 ? (
          <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.EMPTY_DIRECTORY}</p>
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
          <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
          </button>
        ) : null}
      </MobileActivity>
      <MobileDirectoryMenu
        directoryId={directoryId}
        page={page}
        busy={loading || loadingMore}
        open={menuOpen}
        gateway={gateway}
        onClose={onCloseMenu}
        onRefresh={onRefresh}
      />
    </>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
