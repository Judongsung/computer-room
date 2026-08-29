import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "@client/constants/desktop/system-app";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { DocumentsToolbar } from "@client/components/filesystem/documents-toolbar";
import { DocumentsDirectoryView } from "@client/components/filesystem/explorer/documents-directory-view";
import {
  ConfirmDialog,
  DirectoryPickerDialog,
  NameDialog,
} from "@client/components/filesystem/filesystem-dialogs";
import { DownloadTransferDialog } from "@client/components/filesystem/download-transfer-dialog";
import { FilesystemBatchResultDialog } from "@client/components/filesystem/filesystem-batch-result-dialog";
import { FolderPropertiesDialog } from "@client/components/filesystem/details/folder-properties-dialog";
import { useDocumentsController } from "@client/hooks/filesystem/explorer/use-documents-controller";
import type { DocumentsWindowProps } from "@client/types/filesystem/explorer";
import { downloadFile } from "@client/utils/download-file";

export function DocumentsWindow({
  gateway,
  windowId,
  title,
  iconPath,
  onOpenMedia,
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
    onOpenMedia,
    onOpenWidget,
    onEntryChanged,
    onWidgetsClosed,
    onUploadNodes,
    desktopCapacity,
  });
  const { page, selectedEntries, selected, propertiesTarget, currentDirectoryId } = controller;

  return (
    <DesktopAppWindow
      {...chrome}
      title={title}
      iconPath={iconPath}
      minWidth={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minWidth}
      minHeight={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minHeight}
      toolbar={
        <DocumentsToolbar
          busy={controller.busy}
          canGoBack={controller.explorer.history.length > 0}
          canGoUp={Boolean(page && page.breadcrumbs.length > 1)}
          canMutate={Boolean(currentDirectoryId)}
          canDownload={selectedEntries.some((entry) => entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET)}
          canRename={Boolean(selected)}
          canShowProperties={Boolean(propertiesTarget)}
          hasSelection={selectedEntries.length > 0}
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
        />
      }
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {selectedEntries.length > 0
            ? FILESYSTEM_COPY.SELECTED_COUNT(selectedEntries.length)
            : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      {controller.error ? <p className="explorer-message" role="alert">{controller.error}</p> : null}
      {!page && !controller.error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page && currentDirectoryId ? (
        <DocumentsDirectoryView
          page={page}
          busy={controller.busy}
          currentDirectoryId={currentDirectoryId}
          dropTargetId={controller.dropTargetId}
          contentRef={controller.contentRef}
          selection={controller.selection}
          marquee={controller.marquee}
          selectedDirectory={controller.selectedDirectory}
          thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
          onNavigateDirect={controller.explorer.navigateDirect}
          onChangeSort={(sort) => void controller.changeSort(sort)}
          onOpenEntry={controller.openEntry}
          onShowProperties={controller.folderProperties.open}
          onDropTargetChange={controller.setDropTargetId}
          onDropIntoDirectory={controller.dropIntoDirectory}
          onEntryContextMenu={controller.openEntryContextMenu}
          onDirectoryContextMenu={controller.openDirectoryContextMenu}
          onLoadMore={() => void controller.explorer.loadMore()}
        />
      ) : null}
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
            void controller.runChange(async () => {
              onEntryChanged(await gateway.updateEntry(selected.id, { name }));
            })
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
      {controller.unsupportedMedia?.kind === FILESYSTEM_ENTRY_KIND.FILE ? (
        <ConfirmDialog
          title={MEDIA_VIEWER_COPY.UNSUPPORTED_TITLE}
          message={MEDIA_VIEWER_COPY.UNSUPPORTED_MESSAGE}
          busy={false}
          confirmLabel={MEDIA_VIEWER_COPY.DOWNLOAD_FILE}
          cancelLabel={MEDIA_VIEWER_COPY.CANCEL}
          onConfirm={() => {
            downloadFile(gateway.downloadUrl(controller.unsupportedMedia!.id));
            controller.setUnsupportedMedia(null);
          }}
          onCancel={() => controller.setUnsupportedMedia(null)}
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
