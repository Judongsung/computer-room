import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { SystemAppWindow } from "@client/components/desktop/system-app-window";
import { SearchForm } from "@client/components/filesystem/search/search-form";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { useSearchForm, useSearchResults } from "@client/hooks/filesystem/search/use-filesystem-search";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { SystemWindowChromeProps } from "@client/types/desktop/system-app";
import type { SearchLocation } from "@client/types/filesystem/search/search";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemSearchQuery } from "@/types/filesystem/search/search";
import "@client/styles/desktop/filesystem/search.css";

interface SearchWindowProps extends SystemWindowChromeProps {
  readonly gateway: FilesystemGateway;
  readonly location: SearchLocation;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onOpenDirectory: (id: string, title: string) => void;
}

export function SearchWindow({
  gateway,
  location,
  onOpenEntry,
  onOpenDirectory,
  ...chrome
}: SearchWindowProps) {
  const form = useSearchForm(location);
  return (
    <SystemAppWindow {...chrome} appId={SYSTEM_APP_ID.SEARCH} bodyClassName="desktop-search">
      <SearchForm form={form} directory={location.directory} />
      {form.query ? (
        <SearchResults
          gateway={gateway}
          query={form.query}
          revision={form.revision}
          onOpenEntry={onOpenEntry}
          onOpenDirectory={onOpenDirectory}
        />
      ) : null}
    </SystemAppWindow>
  );
}

interface SearchResultsProps {
  readonly gateway: FilesystemGateway;
  readonly query: FilesystemSearchQuery;
  readonly revision: number;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onOpenDirectory: (id: string, title: string) => void;
}

function SearchResults({
  gateway,
  query,
  revision,
  onOpenEntry,
  onOpenDirectory,
}: SearchResultsProps) {
  const results = useSearchResults(gateway, query, revision);
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
