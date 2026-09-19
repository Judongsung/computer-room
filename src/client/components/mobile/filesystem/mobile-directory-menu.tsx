import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useEffect, useLayoutEffect, useState } from "react";
import { FOLDER_PROPERTIES_STATUS } from "@client/constants/filesystem/details";
import type { MobileNavigationGuard } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import { MobileDirectorySortDialog } from "@client/components/mobile/filesystem/mobile-directory-sort-dialog";
import { MobileFolderPropertiesDialog } from "@client/components/mobile/filesystem/mobile-folder-properties-dialog";
import { MobileMenu } from "@client/components/mobile/shared/mobile-menu";
import { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

interface MobileDirectoryMenuProps {
  readonly directoryId: string;
  readonly page: FilesystemDirectoryPage | null;
  readonly busy: boolean;
  readonly open: boolean;
  readonly gateway: FilesystemDirectoryGateway;
  readonly onClose: () => void;
  readonly onSearch: () => void;
  readonly onSortChanged: () => void;
  readonly onRefresh: () => void;
  readonly selecting: boolean;
  readonly onSelect: () => void;
  readonly onCreate: () => void;
  readonly onUpload: () => void;
  readonly onGuardChange: (guard: MobileNavigationGuard) => void;
}

export function MobileDirectoryMenu({
  directoryId,
  page,
  busy,
  open,
  gateway,
  onClose,
  onSearch,
  onRefresh,
  onSortChanged,
  selecting,
  onSelect,
  onCreate,
  onUpload,
  onGuardChange,
}: MobileDirectoryMenuProps) {
  const properties = useFolderProperties(gateway);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBusy, setSortBusy] = useState(false);
  const closeProperties = properties.close;

  useEffect(() => {
    closeProperties();
    setSortOpen(false);
  }, [closeProperties, directoryId, gateway]);

  useLayoutEffect(() => {
    onGuardChange(() => {
      if (sortOpen) {
        if (!sortBusy) setSortOpen(false);
        return false;
      }
      if (properties.state.status !== FOLDER_PROPERTIES_STATUS.CLOSED) {
        closeProperties();
        return false;
      }
      return true;
    });
    return () => onGuardChange(null);
  }, [sortOpen, sortBusy, properties.state.status, closeProperties, onGuardChange]);

  const available = page !== null && !busy && !selecting;
  return (
    <>
      <MobileMenu open={open} onClose={onClose}>
        <button type="button" disabled={!available} onClick={() => { onClose(); onUpload(); }}>{FILESYSTEM_COPY.UPLOAD_FILES}</button>
        <button type="button" disabled={!available} onClick={() => { onClose(); onCreate(); }}>{FILESYSTEM_COPY.NEW_FOLDER}</button>
        <button type="button" disabled={!available || !page?.items.length} onClick={() => { onClose(); onSelect(); }}>{MOBILE_FILESYSTEM_COPY.SELECT}</button>
        <button
          type="button"
          disabled={!available}
          onClick={() => {
            onSearch();
            onClose();
          }}
        >
          {FILESYSTEM_SEARCH_COPY.TITLE}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onRefresh();
            onClose();
          }}
        >
          {MOBILE_COPY.REFRESH}
        </button>
        <button
          type="button"
          disabled={!available}
          onClick={() => {
            if (!page) return;
            properties.open({
              id: page.directory.id,
              name: page.directory.name,
            });
            onClose();
          }}
        >
          {MOBILE_COPY.DETAILS}
        </button>
        <button
          type="button"
          disabled={!available}
          onClick={() => {
            setSortOpen(true);
            onClose();
          }}
        >
          {MOBILE_COPY.SORT}
        </button>
      </MobileMenu>

      <MobileFolderPropertiesDialog controller={properties} />
      {sortOpen && page ? (
        <MobileDirectorySortDialog
          onBusyChange={setSortBusy}
          key={`${page.directory.id}:${page.sort.field}:${page.sort.direction}`}
          directory={page.directory}
          sort={page.sort}
          gateway={gateway}
          onClose={() => setSortOpen(false)}
          onSaved={() => {
            setSortOpen(false);
            onSortChanged();
          }}
        />
      ) : null}
    </>
  );
}
