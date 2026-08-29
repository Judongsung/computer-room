import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemGateway, DesktopFilesystemDialog } from "@client/types/filesystem/filesystem";
import type { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import type { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import type { useWidgetFileLifecycle } from "@client/hooks/widgets/use-widget-file-lifecycle";
import type { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import { DirectoryPickerDialog, NameDialog } from "@client/components/filesystem/filesystem-dialogs";
import { UnsavedWidgetDialog, WidgetSaveDialog } from "@client/components/filesystem/widget-file-dialogs";
import { UploadTransferDialog } from "@client/components/filesystem/upload-transfer-dialog";
import { DownloadTransferDialog } from "@client/components/filesystem/download-transfer-dialog";
import { FilesystemBatchResultDialog } from "@client/components/filesystem/filesystem-batch-result-dialog";
import { FolderPropertiesDialog } from "@client/components/filesystem/details/folder-properties-dialog";

interface DesktopDialogLayerProps {
  readonly gateway: FilesystemGateway;
  readonly widgets: readonly DashboardWidget[];
  readonly dialog: DesktopFilesystemDialog;
  readonly dialogBusy: boolean;
  readonly widgetFiles: ReturnType<typeof useWidgetFileLifecycle>;
  readonly upload: ReturnType<typeof useFilesystemUpload>;
  readonly download: ReturnType<typeof useFilesystemDownload>;
  readonly batchResult: FilesystemBatchResult | null;
  readonly folderProperties: ReturnType<typeof useFolderProperties>;
  readonly onCreate: (name: string) => void;
  readonly onRename: (name: string) => void;
  readonly onMove: (parentId: string) => void;
  readonly onCloseDialog: () => void;
  readonly onCloseBatchResult: () => void;
}

export function DesktopDialogLayer({
  gateway,
  widgets,
  dialog,
  dialogBusy,
  widgetFiles,
  upload,
  download,
  batchResult,
  folderProperties,
  onCreate,
  onRename,
  onMove,
  onCloseDialog,
  onCloseBatchResult,
}: DesktopDialogLayerProps) {
  return (
    <>
      {dialog?.kind === "create" ? (
        <NameDialog
          title={FILESYSTEM_COPY.CREATE_FOLDER_TITLE}
          label={FILESYSTEM_COPY.FOLDER_NAME}
          busy={dialogBusy}
          onSubmit={onCreate}
          onCancel={onCloseDialog}
        />
      ) : null}
      {dialog?.kind === "rename" && dialog.entries[0] ? (
        <NameDialog
          title={FILESYSTEM_COPY.RENAME_TITLE}
          label={FILESYSTEM_COPY.ENTRY_NAME}
          initialValue={dialog.entries[0].name}
          busy={dialogBusy}
          onSubmit={onRename}
          onCancel={onCloseDialog}
        />
      ) : null}
      {dialog?.kind === "move" ? (
        <DirectoryPickerDialog
          gateway={gateway}
          excludedEntryIds={dialog.entries
            .filter((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY)
            .map((entry) => entry.id)}
          busy={dialogBusy}
          onSelect={onMove}
          onCancel={onCloseDialog}
        />
      ) : null}
      {widgetFiles.saveWidgetId ? (
        <WidgetSaveDialog
          gateway={gateway}
          widgetType={widgets.find((widget) => widget.id === widgetFiles.saveWidgetId)?.type ?? WIDGET_TYPE.MEMO}
          busy={widgetFiles.busy}
          onSave={(parentId, name) => void widgetFiles.save(parentId, name)}
          onCancel={widgetFiles.cancelSave}
        />
      ) : null}
      {widgetFiles.closePromptWidgetId ? (
        <UnsavedWidgetDialog
          busy={widgetFiles.busy}
          onSave={widgetFiles.chooseSave}
          onDiscard={widgetFiles.discard}
          onCancel={widgetFiles.cancelClose}
        />
      ) : null}
      <UploadTransferDialog state={upload.state} onClose={upload.close} />
      <DownloadTransferDialog state={download.state} onCancel={download.cancel} onClose={download.close} />
      <FilesystemBatchResultDialog result={batchResult} onClose={onCloseBatchResult} />
      <FolderPropertiesDialog controller={folderProperties} />
    </>
  );
}
