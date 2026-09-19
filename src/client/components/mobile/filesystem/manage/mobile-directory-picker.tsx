import { useState } from "react";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID, FILESYSTEM_ROOT_NAME } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface Props {
  readonly gateway: FilesystemGateway;
  readonly sourceId: string;
  readonly excludedIds: readonly string[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
}

export function MobileDirectoryPicker({ gateway, sourceId, excludedIds, busy, error, onSelect, onClose }: Props) {
  const [directoryId, setDirectoryId] = useState(sourceId);
  const query = usePaginatedDirectory({ gateway, directoryId, errorFallback: FILESYSTEM_COPY.LOAD_FAILED });
  const page = query.page;
  const blocked = !page || page.directory.id === sourceId ||
    page.breadcrumbs.some((entry) => excludedIds.includes(entry.id));
  return <MobileDialog title={FILESYSTEM_COPY.MOVE_TITLE} actions={<>
    <button type="button" disabled={busy || blocked || query.isRefreshing} onClick={() => page && onSelect(page.directory.id)}>{FILESYSTEM_COPY.MOVE_HERE}</button>
    <button type="button" disabled={busy} onClick={onClose}>{FILESYSTEM_COPY.CANCEL}</button>
  </>}>
    {[FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_ID.DOCUMENTS].map((id) =>
      <button key={id} type="button" disabled={busy} onClick={() => setDirectoryId(id)}>
        {id === FILESYSTEM_ROOT_ID.DESKTOP ? FILESYSTEM_ROOT_NAME.DESKTOP : FILESYSTEM_ROOT_NAME.DOCUMENTS}
      </button>)}
    <nav>{page?.breadcrumbs.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => setDirectoryId(item.id)}>{item.name}</button>)}</nav>
    {!page && !query.error ? <p>{FILESYSTEM_COPY.BUSY}</p> : null}
    <ul>{page?.items.filter((item) => item.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY && !excludedIds.includes(item.id))
      .map((item) => <li key={item.id}><button type="button" disabled={busy} onClick={() => setDirectoryId(item.id)}>{item.name}</button></li>)}</ul>
    {page?.nextOffset != null ? <button type="button" disabled={busy || query.isLoadingMore || query.isRefreshing} onClick={() => void query.loadMore()}>{FILESYSTEM_COPY.LOAD_MORE}</button> : null}
    {query.error ? <p role="alert">{query.error}<button type="button" disabled={busy} onClick={() => void query.retry()}>{FILESYSTEM_COPY.RETRY}</button></p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </MobileDialog>;
}
