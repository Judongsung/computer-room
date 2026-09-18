import { useCallback, useLayoutEffect, useState } from "react";
import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { mergeFilesystemItems, useFilesystemPages } from "@client/hooks/filesystem/use-filesystem-pages";
import type { FilesystemSearchKind, FilesystemSearchPage, FilesystemSearchQuery } from "@/types/filesystem/search/search";
import type { FilesystemSearchGateway } from "@client/types/filesystem/ports/search";
import type { SearchLocation } from "@client/types/filesystem/search/search";

export function useSearchForm(location: SearchLocation, onSubmitted?: (query: FilesystemSearchQuery) => void) {
  const [q, setQ] = useState(location.initialQuery?.q ?? "");
  const [kind, setKind] = useState<FilesystemSearchKind>(location.initialQuery?.kind ?? FILESYSTEM_SEARCH_KIND.ALL);
  const [scoped, setScoped] = useState(
    location.initialQuery
      ? location.initialQuery.directoryId !== undefined
      : location.directory !== null,
  );
  const [query, setQuery] = useState<FilesystemSearchQuery | null>(location.initialQuery ?? null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    const normalized = q.normalize("NFC").trim();
    if (!normalized || new TextEncoder().encode(normalized).length > MAX_FILE_NAME_BYTES) {
      setError(FILESYSTEM_SEARCH_COPY.INVALID);
      return;
    }
    const next: FilesystemSearchQuery = {
      q: normalized,
      kind,
      ...(scoped && location.directory ? { directoryId: location.directory.id } : {}),
    };
    setError(null);
    if (query?.q === next.q && query.kind === next.kind && query.directoryId === next.directoryId) {
      setRevision((current) => current + 1);
    } else {
      setQuery(next);
    }
    onSubmitted?.(next);
  };
  return { q, setQ, kind, setKind, scoped, setScoped, query, revision, error, submit };
}

export function useSearchResults(gateway: FilesystemSearchGateway, query: FilesystemSearchQuery, revision: number) {
  const read = useCallback((offset: number) => gateway.search(query, offset), [gateway, query]);
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
