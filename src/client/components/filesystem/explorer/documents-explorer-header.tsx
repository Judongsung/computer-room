import type {
  ChangeEvent,
  DragEvent,
  RefObject,
} from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { ExplorerBreadcrumbs } from "@client/components/filesystem/header/explorer-breadcrumbs";
import { XpExplorerHeader } from "@client/components/filesystem/header/xp-explorer-header";
import { buildDocumentsExplorerHeaderModel } from "@client/domain/filesystem/explorer-header-menu";

interface DocumentsExplorerHeaderProps {
  readonly page: FilesystemDirectoryPage | null;
  readonly fallbackAddress: string;
  readonly locationIconPath: string;
  readonly busy: boolean;
  readonly canGoBack: boolean;
  readonly selectedEntries: readonly FilesystemEntry[];
  readonly propertiesTarget: Extract<FilesystemEntry, { readonly kind: "directory" }> | null;
  readonly dropTargetId: string | null;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly folderInputRef: RefObject<HTMLInputElement | null>;
  readonly onBack: () => void;
  readonly onUp: () => void;
  readonly onCreate: () => void;
  readonly onSelectFiles: () => void;
  readonly onSelectFolder: () => void;
  readonly onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDownload: () => void | Promise<unknown>;
  readonly onRename: () => void;
  readonly onMove: () => void;
  readonly onDelete: () => void | Promise<unknown>;
  readonly onShowProperties: () => void;
  readonly onSelectAll: () => void;
  readonly onRefresh: () => void | Promise<unknown>;
  readonly onChangeSort: (sort: FilesystemDirectorySort) => void | Promise<unknown>;
  readonly onClose: () => void;
  readonly onNavigateDirect: (directoryId: string) => void;
  readonly onDropTargetChange: (id: string | null) => void;
  readonly onDropIntoDirectory: (event: DragEvent, parentId: string) => void;
}
export function DocumentsExplorerHeader({
  page,
  fallbackAddress,
  locationIconPath,
  busy,
  canGoBack,
  selectedEntries,
  propertiesTarget,
  dropTargetId,
  fileInputRef,
  folderInputRef,
  onBack,
  onUp,
  onCreate,
  onSelectFiles,
  onSelectFolder,
  onUpload,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onShowProperties,
  onSelectAll,
  onRefresh,
  onChangeSort,
  onClose,
  onNavigateDirect,
  onDropTargetChange,
  onDropIntoDirectory,
}: DocumentsExplorerHeaderProps) {
  const selected = selectedEntries.length === 1 ? selectedEntries[0] ?? null : null;
  const model = buildDocumentsExplorerHeaderModel(
    {
      busy,
      canGoBack,
      canGoUp: Boolean(page && page.breadcrumbs.length > 1),
      canMutate: Boolean(page?.directory.id),
      canDownload: selectedEntries.some(
        (entry) => entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET,
      ),
      canRename: Boolean(selected),
      canShowProperties: Boolean(propertiesTarget),
      hasSelection: selectedEntries.length > 0,
      hasItems: Boolean(page?.items.length),
      sort: page?.sort ?? null,
    },
    {
      goBack: onBack,
      goUp: onUp,
      createDirectory: onCreate,
      uploadFiles: onSelectFiles,
      uploadFolder: onSelectFolder,
      download: onDownload,
      rename: onRename,
      move: onMove,
      delete: onDelete,
      showProperties: onShowProperties,
      selectAll: onSelectAll,
      refresh: onRefresh,
      changeSort: onChangeSort,
      close: onClose,
    },
  );

  return (
    <>
      <XpExplorerHeader
        menus={model.menus}
        toolbarItems={model.toolbarItems}
        locationIconPath={locationIconPath}
        address={
          page ? (
            <ExplorerBreadcrumbs
              items={page.breadcrumbs}
              onNavigate={(item) => onNavigateDirect(item.id)}
              drop={{
                targetId: dropTargetId,
                onTargetChange: onDropTargetChange,
                onDrop: onDropIntoDirectory,
              }}
            />
          ) : (
            fallbackAddress
          )
        }
      />
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        multiple
        onChange={onUpload}
      />
      <input
        ref={folderInputRef}
        className="visually-hidden"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={onUpload}
      />
    </>
  );
}
