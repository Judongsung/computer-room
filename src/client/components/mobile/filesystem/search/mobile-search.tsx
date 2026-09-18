import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { SearchForm } from "@client/components/filesystem/search/search-form";
import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { useSearchForm, useSearchResults } from "@client/hooks/filesystem/search/use-filesystem-search";
import type { SearchLocation } from "@client/types/filesystem/search/search";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemSearchQuery } from "@/types/filesystem/search/search";
import "@client/styles/mobile/search/search.css";

interface MobileSearchProps {
  readonly gateway: FilesystemGateway;
  readonly location: SearchLocation;
  readonly onSubmitted: (query: FilesystemSearchQuery) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onOpenDirectory: (id: string, title: string) => void;
}
export function MobileSearch(props: MobileSearchProps) {
  const form = useSearchForm(props.location, props.onSubmitted);
  return (
    <MobileActivity title={FILESYSTEM_SEARCH_COPY.TITLE}>
      <div className="mobile-search">
        <SearchForm form={form} directory={props.location.directory} />
        {form.query ? (
          <MobileSearchResults {...props} query={form.query} revision={form.revision} />
        ) : null}
      </div>
    </MobileActivity>
  );
}

interface MobileSearchResultsProps extends MobileSearchProps {
  readonly query: FilesystemSearchQuery;
  readonly revision: number;
}

function MobileSearchResults({
  gateway,
  query,
  revision,
  onOpenEntry,
  onOpenDirectory,
}: MobileSearchResultsProps) {
  const results = useSearchResults(gateway, query, revision);
  return (
    <div>
      <FilesystemScrollRetention location={JSON.stringify(query)} scope={gateway} />
      {results.isInitialLoading || results.isRefreshing ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{FILESYSTEM_COPY.BUSY}</p>
      ) : null}
      {results.error ? (
        <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
          {results.error}
          <button type="button" onClick={() => void results.retry()}>
            {FILESYSTEM_COPY.RETRY}
          </button>
        </p>
      ) : null}
      {results.page?.items.length === 0 ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{FILESYSTEM_SEARCH_COPY.EMPTY}</p>
      ) : null}
      <ul className={MOBILE_CLASS_NAME.LIST}>
        {results.page?.items.map(({ entry, parentPath }) => (
          <li key={entry.id} className="mobile-search__row">
            <button
              className={MOBILE_CLASS_NAME.LIST_ITEM}
              type="button"
              onClick={() => onOpenEntry(entry)}
            >
              <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                <MobileEntryIcon entry={entry} gateway={gateway} />
              </span>
              <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                <strong>{entry.name}</strong>
                <small className={MOBILE_CLASS_NAME.LIST_META}>{parentPath}</small>
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
          </li>
        ))}
      </ul>
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
