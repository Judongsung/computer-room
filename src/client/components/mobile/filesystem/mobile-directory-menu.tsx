import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useEffect, useState } from "react";
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
  readonly onRefresh: () => void;
}

export function MobileDirectoryMenu({
  directoryId,
  page,
  busy,
  open,
  gateway,
  onClose,
  onRefresh,
}: MobileDirectoryMenuProps) {
  const properties = useFolderProperties(gateway);
  const [sortOpen, setSortOpen] = useState(false);
  const closeProperties = properties.close;

  useEffect(() => {
    closeProperties();
    setSortOpen(false);
  }, [closeProperties, directoryId]);

  const available = page !== null && !busy;
  return (
    <>
      <MobileMenu open={open} onClose={onClose}>
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
          key={`${page.directory.id}:${page.sort.field}:${page.sort.direction}`}
          directory={page.directory}
          sort={page.sort}
          gateway={gateway}
          onClose={() => setSortOpen(false)}
          onSaved={() => {
            setSortOpen(false);
            onRefresh();
          }}
        />
      ) : null}
    </>
  );
}
