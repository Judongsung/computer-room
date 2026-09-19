import { useState } from "react";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { SearchForm } from "@client/components/filesystem/search/search-form";
import { ExplorerSearchResults } from "@client/components/desktop/filesystem/explorer-search-results";
import { useSearchForm, useSearchResults } from "@client/hooks/filesystem/search/use-filesystem-search";
import "@client/styles/desktop/filesystem/search.css";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "@client/constants/desktop/system-app";
import {
  FILESYSTEM_DRAG_SOURCE,
} from "@client/constants/filesystem/filesystem";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { DocumentsExplorerHeader } from "@client/components/filesystem/explorer/documents-explorer-header";
import { ExplorerDirectoryView } from "@client/components/filesystem/explorer/explorer-directory-view";
import {
  DirectoryPickerDialog,
  NameDialog,
} from "@client/components/filesystem/filesystem-dialogs";
import { DownloadTransferDialog } from "@client/components/filesystem/download-transfer-dialog";
import { FilesystemBatchResultDialog } from "@client/components/filesystem/filesystem-batch-result-dialog";
import { FolderPropertiesDialog } from "@client/components/filesystem/details/folder-properties-dialog";
import { useDocumentsController } from "@client/hooks/filesystem/explorer/use-documents-controller";
import { writeFilesystemDragPayload } from "@client/domain/filesystem/drag";
import type { DocumentsWindowProps } from "@client/types/filesystem/explorer";

export function DocumentsWindow({
  gateway,
  windowId,
  title,
  iconPath,
  onOpenFile,
  initialDirectoryId,
  onDirectoryChanged,
  onOpenWidget,
  onEntryChanged,
  onWidgetsClosed,
  onUploadNodes,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: DocumentsWindowProps) {
  const controller = useDocumentsController({
    gateway,
    windowId,
    initialDirectoryId,
    filesystemRevision,
    onFilesystemChanged,
    onDirectoryChanged,
    onOpenFile,
    onOpenWidget,
    onEntryChanged,
    onWidgetsClosed,
    onUploadNodes,
    desktopCapacity,
  });
  const { page, selectedEntries, selected, propertiesTarget, currentDirectoryId } = controller;
  const [searchOpen, setSearchOpen] = useState(false);
  const directory = {
    id: controller.explorer.directoryId,
    name: page?.directory.name ?? FILESYSTEM_COPY.BUSY,
  };
  const form = useSearchForm({ directory }, () => controller.selection.clear());
  const query = searchOpen ? form.query : null;
  const results = useSearchResults(gateway, query, form.revision);
  const searching = query !== null;
  const closeSearch = (): void => {
    setSearchOpen(false);
    form.reset();
  };

  return (
    <DesktopAppWindow
      {...chrome}
      title={title}
      iconPath={iconPath}
      minWidth={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minWidth}
      minHeight={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minHeight}
      toolbarClassName={XP_EXPLORER_HEADER_CLASS_NAME.FRAME_TOOLBAR}
      toolbar={
        <DocumentsExplorerHeader
          searchOpen={searchOpen}
          searching={searching}
          onSearch={() => searchOpen ? closeSearch() : setSearchOpen(true)}
          page={page}
          fallbackAddress={title}
          locationIconPath={iconPath}
          busy={controller.busy}
          canGoBack={controller.explorer.history.length > 0}
          selectedEntries={selectedEntries}
          propertiesTarget={propertiesTarget}
          dropTargets={controller.dropTargets}
          fileInputRef={controller.fileInputRef}
          folderInputRef={controller.folderInputRef}
          onBack={controller.explorer.navigateBack}
          onUp={controller.explorer.navigateUp}
          onCreate={() => controller.setDialog("create")}
          onSelectFiles={() => controller.fileInputRef.current?.click()}
          onSelectFolder={controller.selectFolder}
          onUpload={controller.uploadSelection}
          onDownload={() => void controller.download.start(selectedEntries)}
          onRename={() => controller.setDialog("rename")}
          onMove={() => controller.setDialog("move")}
          onDelete={() =>
            void controller.runBatchChange(() =>
              gateway.trashEntries(controller.selection.selectedInOrder),
            )
          }
          onShowProperties={() =>
            propertiesTarget && controller.folderProperties.open(propertiesTarget)
          }
          onSelectAll={controller.selection.selectAll}
          onRefresh={searching ? results.reload : controller.explorer.reload}
          onChangeSort={controller.changeSort}
          onClose={chrome.onClose}
          onNavigateDirect={(id) => {
            form.reset();
            controller.explorer.navigateDirect(id);
          }}
          onDropIntoDirectory={controller.dropIntoDirectory}
        />
      }
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {searching
            ? `${results.page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`
            : selectedEntries.length > 0
              ? FILESYSTEM_COPY.SELECTED_COUNT(selectedEntries.length)
              : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      <div
        className="explorer-search-layout"
        {...(searching ? controller.dropTargets.getProps(
          `${windowId}:search`,
          () => undefined,
          { disabled: true },
        ) : {})}
      >
        {searchOpen ? (
          <aside className="explorer-search-sidebar" aria-label={FILESYSTEM_SEARCH_COPY.TITLE}>
            <header>
              <strong>{FILESYSTEM_SEARCH_COPY.TITLE}</strong>
              <button type="button" onClick={closeSearch}>{FILESYSTEM_SEARCH_COPY.CLOSE}</button>
            </header>
            <SearchForm form={form} directory={directory} disabled={!page || controller.busy} />
          </aside>
        ) : null}
        <div className="explorer-search-main">
          {query ? (
            <ExplorerSearchResults
              gateway={gateway}
              query={query}
              results={results}
              onOpenEntry={(entry) => {
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) form.reset();
                controller.openEntry(entry);
              }}
              onOpenDirectory={(id) => {
                form.reset();
                controller.explorer.navigate(id);
              }}
            />
          ) : (
            <>
              {controller.error ? <p className="explorer-message" role="alert">{controller.error}</p> : null}
              {controller.explorer.error ? (
                <button
                  type="button"
                  disabled={controller.explorer.isRefreshing}
                  onClick={() => void controller.explorer.retry()}
                >
                  {FILESYSTEM_COPY.RETRY}
                </button>
              ) : null}
              {!page && !controller.error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
              {page && currentDirectoryId ? (
                <ExplorerDirectoryView
                  page={page}
                  busy={controller.busy}
                  currentDirectoryId={currentDirectoryId}
                  selection={{
                    selectedIds: controller.selection.selectedIds,
                    onSelect: controller.selection.select,
                    onSelectAll: controller.selection.selectAll,
                    onClear: controller.selection.clear,
                  }}
                  marquee={{
                    contentRef: controller.contentRef,
                    ...controller.marquee,
                  }}
                  drag={{
                    targets: controller.dropTargets,
                    disabled: controller.busy,
                    onDrop: controller.dropIntoDirectory,
                    onDragStart: (entry, event) => {
                      const ids = controller.selection.dragIds(entry.id);
                      controller.selection.replace(ids);
                      writeFilesystemDragPayload(event.dataTransfer, {
                        ids,
                        primaryId: entry.id,
                        source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
                      });
                    },
                  }}
                  properties={{
                    selectedDirectory: controller.selectedDirectory,
                    onShow: controller.folderProperties.open,
                  }}
                  contextMenu={{
                    onEntry: controller.openEntryContextMenu,
                    onDirectory: controller.openDirectoryContextMenu,
                  }}
                  thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
                  emptyLabel={FILESYSTEM_COPY.EMPTY_DIRECTORY}
                  loadMoreLabel={FILESYSTEM_COPY.LOAD_MORE}
                  onOpenEntry={controller.openEntry}
                  onLoadMore={() => void controller.explorer.loadMore()}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
      {controller.dialog === "create" && currentDirectoryId ? (
        <NameDialog
          title={FILESYSTEM_COPY.CREATE_FOLDER_TITLE}
          label={FILESYSTEM_COPY.FOLDER_NAME}
          busy={controller.busy}
          onSubmit={(name) =>
            void controller.runChange(() => gateway.createDirectory(currentDirectoryId, name))
          }
          onCancel={() => controller.setDialog(null)}
        />
      ) : null}
      {controller.dialog === "rename" && selected ? (
        <NameDialog
          title={FILESYSTEM_COPY.RENAME_TITLE}
          label={FILESYSTEM_COPY.ENTRY_NAME}
          initialValue={selected.name}
          busy={controller.busy}
          onSubmit={(name) =>
            void controller.renameEntry(selected.id, name)
          }
          onCancel={() => controller.setDialog(null)}
        />
      ) : null}
      {controller.dialog === "move" && selectedEntries.length > 0 ? (
        <DirectoryPickerDialog
          gateway={gateway}
          excludedEntryIds={selectedEntries
            .filter((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY)
            .map((entry) => entry.id)}
          busy={controller.busy}
          onSelect={(parentId) =>
            void controller.runBatchChange(() =>
              gateway.moveEntries(controller.selection.selectedInOrder, {
                parentId,
                ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
                  ? { desktopPlacement: { targetIndex: 0, capacity: desktopCapacity } }
                  : {}),
              }),
            )
          }
          onCancel={() => controller.setDialog(null)}
        />
      ) : null}
      <FilesystemBatchResultDialog
        result={controller.batchResult}
        onClose={() => controller.setBatchResult(null)}
      />
      <DownloadTransferDialog
        state={controller.download.state}
        onCancel={controller.download.cancel}
        onClose={controller.download.close}
      />
      <FolderPropertiesDialog controller={controller.folderProperties} />
    </DesktopAppWindow>
  );
}
