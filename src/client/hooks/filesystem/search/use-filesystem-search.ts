import { useCallback, useLayoutEffect, useState } from "react";
import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND, FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { mergeFilesystemItems, useFilesystemPages } from "@client/hooks/filesystem/use-filesystem-pages";
import type { FilesystemSearchKind, FilesystemSearchMode, FilesystemSearchPage, FilesystemSearchQuery } from "@/types/filesystem/search/search";
import type { FilesystemSearchGateway } from "@client/types/filesystem/ports/search";
import type { SearchLocation } from "@client/types/filesystem/search/search";

interface SearchFormState {
  readonly directoryId: string;
  readonly q: string;
  readonly kind: FilesystemSearchKind;
  readonly mode: FilesystemSearchMode;
  readonly query: FilesystemSearchQuery | null;
  readonly revision: number;
  readonly error: string | null;
}

export function useSearchForm(location: SearchLocation, onSubmitted?: (query: FilesystemSearchQuery) => void) {
  const [state, setState] = useState(() => initialFormState(location));
  let current = state;
  // Reset before rendering a new folder so its first frame cannot show old results.
  if (state.directoryId !== location.directory.id) {
    current = initialFormState({ directory: location.directory });
    setState(current);
  }

  const submit = (): void => {
    const q = (current.mode === FILESYSTEM_SEARCH_MODE.NAME ? current.q.normalize("NFC") : current.q).trim();
    if (!q || new TextEncoder().encode(q).length > MAX_FILE_NAME_BYTES) {
      setState({ ...current, error: FILESYSTEM_SEARCH_COPY.INVALID });
      return;
    }
    const next = { q, kind: current.kind, mode: current.mode, directoryId: location.directory.id };
    const repeated = current.query?.q === next.q && current.query.kind === next.kind &&
      (current.query.mode ?? FILESYSTEM_SEARCH_MODE.NAME) === next.mode;
    setState({
      ...current,
      error: null,
      query: repeated ? current.query : next,
      revision: repeated ? current.revision + 1 : 0,
    });
    onSubmitted?.(next);
  };
  return {
    ...current,
    setQ: (q: string) => setState((value) => ({ ...value, q })),
    setKind: (kind: FilesystemSearchKind) => setState((value) => ({ ...value, kind })),
    setMode: (mode: FilesystemSearchMode) => setState((value) => ({ ...value, mode })),
    reset: () => setState(initialFormState({ directory: location.directory })),
    submit,
  };
}

function initialFormState(location: SearchLocation): SearchFormState {
  const query = location.initialQuery
    ? { ...location.initialQuery, directoryId: location.directory.id }
    : null;
  return {
    directoryId: location.directory.id,
    q: query?.q ?? "",
    kind: query?.kind ?? FILESYSTEM_SEARCH_KIND.ALL,
    mode: query?.mode ?? FILESYSTEM_SEARCH_MODE.NAME,
    query,
    revision: 0,
    error: null,
  };
}

export function useSearchResults(gateway: FilesystemSearchGateway, query: FilesystemSearchQuery | null, revision: number) {
  const read = useCallback((offset: number): Promise<FilesystemSearchPage> =>
    query ? gateway.search(query, offset) : Promise.resolve({ items: [], nextOffset: null }),
  [gateway, query]);
  const results = useFilesystemPages(read, mergeResults, 0, FILESYSTEM_SEARCH_COPY.FAILED);
  const { reload } = results;
  // Repeated submissions share a pending reload instead of forcing a new request.
  useLayoutEffect(() => {
    if (revision > 0) void reload();
  }, [reload, revision]);
  return results;
}

function mergeResults(previous: FilesystemSearchPage | null, next: FilesystemSearchPage): FilesystemSearchPage {
  return {
    items: mergeFilesystemItems(previous?.items ?? [], next.items, (item) => item.entry.id),
    nextOffset: next.nextOffset,
  };
}
