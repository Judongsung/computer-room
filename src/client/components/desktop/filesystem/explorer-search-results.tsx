import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import type { useSearchResults } from "@client/hooks/filesystem/search/use-filesystem-search";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemSearchQuery } from "@/types/filesystem/search/search";

interface SearchResultsProps {
  readonly gateway: FilesystemGateway;
  readonly query: FilesystemSearchQuery;
  readonly results: ReturnType<typeof useSearchResults>;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onOpenDirectory: (id: string, title: string) => void;
}

export function ExplorerSearchResults({
  gateway,
  query,
  results,
  onOpenEntry,
  onOpenDirectory,
}: SearchResultsProps) {
  return (
    <div className="desktop-search__results">
      <FilesystemScrollRetention location={JSON.stringify(query)} scope={gateway} />
      {results.isInitialLoading || results.isRefreshing ? <p>{FILESYSTEM_COPY.BUSY}</p> : null}
      {results.error ? (
        <p role="alert">
          {results.error}
          <button type="button" onClick={() => void results.retry()}>
            {FILESYSTEM_COPY.RETRY}
          </button>
        </p>
      ) : null}
      {results.page?.items.length === 0 ? <p>{FILESYSTEM_SEARCH_COPY.EMPTY}</p> : null}
      {results.page?.items.map(({ entry, parentPath }) => (
        <div key={entry.id} className="desktop-search__row">
          <button
            type="button"
            onDoubleClick={() => onOpenEntry(entry)}
            onKeyDown={(event) => {
              if (event.key === KEYBOARD_KEY.ENTER) onOpenEntry(entry);
            }}
          >
            <FilesystemEntryIcon entry={entry} thumbnailUrl={(id) => gateway.thumbnailUrl(id)} />
            <span>
              <strong>{entry.name}</strong>
              <small>{parentPath}</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (entry.parentId) onOpenDirectory(entry.parentId, parentPath);
            }}
          >
            {FILESYSTEM_SEARCH_COPY.OPEN_FOLDER}
          </button>
        </div>
      ))}
      {results.page?.nextOffset != null ? (
        <button
          type="button"
          disabled={results.isLoadingMore || results.isRefreshing}
          onClick={() => void results.loadMore()}
        >
          {FILESYSTEM_COPY.LOAD_MORE}
        </button>
      ) : null}
    </div>
  );
}
