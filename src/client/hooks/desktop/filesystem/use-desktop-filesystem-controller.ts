import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_BEHAVIOR, WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  DesktopPlacement,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { DashboardWidget } from "@/types/widgets/widget";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { desktopIconLayout } from "@client/domain/desktop/desktop-icon-layout";
import { hasInternalFilesystemDrag, readFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { collectDroppedUploadNodes } from "@client/domain/filesystem/local-file-tree";
import { useFilesystemMutation } from "@client/hooks/filesystem/commands/use-filesystem-mutation";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import type { DesktopDimensions } from "@client/types/desktop/window";
import type { SystemAppId } from "@client/types/desktop/system-app";
import type {
  DesktopFilesystemDialog,
  DragFilesystemEntryPayload,
  FilesystemGateway,
} from "@client/types/filesystem/filesystem";
import type { LocalUploadNode } from "@client/types/filesystem/upload";

interface DesktopFilesystemControllerOptions {
  readonly gateway: FilesystemGateway;
  readonly workAreaRef: RefObject<HTMLElement | null>;
  readonly desktop: DesktopDimensions;
  readonly widgets: readonly DashboardWidget[];
  readonly onWidgetChange: (widget: DashboardWidget) => void;
  readonly onRemoveWidgets: (widgetIds: readonly string[]) => void;
  readonly onWindowClosed: (windowId: string) => void;
}

export function useDesktopFilesystemController({
  gateway,
  workAreaRef,
  desktop,
  widgets,
  onWidgetChange,
  onRemoveWidgets,
  onWindowClosed,
}: DesktopFilesystemControllerOptions) {
  const [revision, setRevision] = useState(0);
  const mutation = useFilesystemMutation(gateway);
  const { run: runMutation, reportError, setError: setMutationError } = mutation;
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(null);
  const [dialog, setDialog] = useState<DesktopFilesystemDialog>(null);
  const notifyChanged = useCallback(() => setRevision((current) => current + 1), []);
  const entries = useDesktopEntries(gateway, revision);
  const iconLayout = useMemo(() => desktopIconLayout(desktop), [desktop]);
  const visibleEntries = useMemo(
    () => entries.entries.slice(0, iconLayout.dynamicCapacity),
    [entries.entries, iconLayout.dynamicCapacity],
  );
  const visibleEntryIds = useMemo(
    () => visibleEntries.map((entry) => entry.id),
    [visibleEntries],
  );
  const selection = useFilesystemSelection(visibleEntryIds);
  const { replace: replaceSelection } = selection;
  const marquee = useFilesystemMarqueeSelection(
    workAreaRef,
    selection.selectedIds,
    replaceSelection,
  );
  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selection.selectedIds.has(entry.id)),
    [selection.selectedIds, visibleEntries],
  );
  const upload = useFilesystemUpload(gateway, notifyChanged);
  const download = useFilesystemDownload(gateway);
  const folderProperties = useFolderProperties(gateway);
  const overflowCount = Math.max(0, entries.entries.length - visibleEntries.length);

  const desktopPlacement = useCallback(
    (targetIndex = entries.entries.length): DesktopPlacement => ({
      targetIndex,
      capacity: iconLayout.dynamicCapacity,
    }),
    [entries.entries.length, iconLayout.dynamicCapacity],
  );

  const latest = useRef({ widgets, onWidgetChange, onRemoveWidgets, onWindowClosed });
  useLayoutEffect(() => {
    latest.current = { widgets, onWidgetChange, onRemoveWidgets, onWindowClosed };
  });

  const synchronizeWidgetFile = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) return;
      const current = latest.current;
      const widget = current.widgets.find((candidate) => candidate.id === entry.widgetId);
      if (
        !widget ||
        !WIDGET_BEHAVIOR[widget.type].supportsFileStorage ||
        (widget.type !== WIDGET_TYPE.MEMO &&
          widget.type !== WIDGET_TYPE.DAILY_CHECKLIST)
      ) {
        return;
      }
      current.onWidgetChange({
        ...widget,
        file: { entryId: entry.id, parentId: entry.parentId, name: entry.name },
      });
    },
    [],
  );

  const removeWidgetWindows = useCallback(
    (widgetIds: readonly string[]): void => {
      if (widgetIds.length === 0) return;
      widgetIds.forEach(latest.current.onWindowClosed);
      latest.current.onRemoveWidgets(widgetIds);
    },
    [],
  );

  const applyBatchResult = useCallback(
    (result: FilesystemBatchResult): void => {
      result.entries.forEach(synchronizeWidgetFile);
      removeWidgetWindows(result.closedWidgetIds);
      setBatchResult(result.failures.length > 0 ? result : null);
      replaceSelection(result.failures.map((failure) => failure.id));
    },
    [removeWidgetWindows, replaceSelection, synchronizeWidgetFile],
  );

  const runFilesystemChange = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      onSuccess: (value: T) => void = () => undefined,
    ): Promise<void> => {
      await runMutation(operation, (value) => {
        onSuccess(value);
        notifyChanged();
      });
    },
    [runMutation, notifyChanged],
  );

  const movePayload = useCallback(
    (
      payload: DragFilesystemEntryPayload,
      parentId: string,
      targetIndex?: number,
    ): Promise<FilesystemBatchResult> => {
      const placement =
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? desktopPlacement(targetIndex)
          : undefined;
      return payload.source === FILESYSTEM_DRAG_SOURCE.TRASH
        ? gateway.restoreEntries(payload.ids, {
            parentId,
            ...(placement ? { desktopPlacement: placement } : {}),
          })
        : gateway.moveEntries(payload.ids, {
            parentId,
            ...(placement ? { desktopPlacement: placement } : {}),
          });
    },
    [desktopPlacement, gateway],
  );

  const uploadDrop = useCallback(
    async (event: DragEvent, parentId: string): Promise<void> => {
      const dropped = await collectDroppedUploadNodes(event.dataTransfer.items);
      await upload.upload(
        dropped.nodes,
        parentId,
        parentId === FILESYSTEM_ROOT_ID.DESKTOP ? desktopPlacement() : undefined,
        dropped.folderDropUnsupported ? FILESYSTEM_COPY.FOLDER_DROP_UNSUPPORTED : null,
      );
    },
    [desktopPlacement, upload],
  );

  const handleDrop = useCallback(
    (event: DragEvent, parentId: string, targetIndex?: number): void => {
      const payload = readFilesystemDragPayload(event.dataTransfer);
      if (payload) {
        void runFilesystemChange(
          () => movePayload(payload, parentId, targetIndex),
          applyBatchResult,
        );
      } else if (hasInternalFilesystemDrag(event.dataTransfer)) {
        setMutationError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
      } else {
        void uploadDrop(event, parentId).catch(reportError);
      }
    },
    [applyBatchResult, movePayload, reportError, setMutationError, runFilesystemChange, uploadDrop],
  );

  const trashEntries = useCallback(
    (targets: readonly FilesystemEntry[]): void => {
      const ids = targets.map(({ id }) => id);
      void runFilesystemChange(() => gateway.trashEntries(ids), applyBatchResult);
    },
    [applyBatchResult, gateway, runFilesystemChange],
  );

  const dropOnSystemApp = useCallback(
    (id: SystemAppId, event: DragEvent<HTMLButtonElement>): void => {
      if (id === SYSTEM_APP_ID.MY_COMPUTER) {
        setMutationError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
        return;
      }
      const payload = readFilesystemDragPayload(event.dataTransfer);
      if (id === SYSTEM_APP_ID.RECYCLE_BIN) {
        if (!payload || payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
          setMutationError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
          return;
        }
        void runFilesystemChange(
          () => gateway.trashEntries(payload.ids),
          applyBatchResult,
        );
      } else {
        handleDrop(event, FILESYSTEM_ROOT_ID.DOCUMENTS);
      }
    },
    [applyBatchResult, gateway, handleDrop, setMutationError, runFilesystemChange],
  );

  const dropOnEntry = useCallback(
    (entry: FilesystemEntry, index: number, event: DragEvent<HTMLButtonElement>): void => {
      handleDrop(
        event,
        entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
          ? entry.id
          : FILESYSTEM_ROOT_ID.DESKTOP,
        entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ? undefined : index,
      );
    },
    [handleDrop],
  );

  const createDirectory = useCallback(
    (name: string): void => {
      void runFilesystemChange(
        () => gateway.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, name, desktopPlacement()),
        () => setDialog(null),
      );
    },
    [desktopPlacement, gateway, runFilesystemChange],
  );

  const renameEntry = useCallback(
    (name: string): void => {
      if (dialog?.kind !== "rename" || !dialog.entries[0]) return;
      const entryId = dialog.entries[0].id;
      void runFilesystemChange(
        () => gateway.updateEntry(entryId, { name }),
        (entry) => {
          synchronizeWidgetFile(entry);
          setDialog(null);
        },
      );
    },
    [dialog, gateway, runFilesystemChange, synchronizeWidgetFile],
  );

  const moveDialogEntries = useCallback(
    (parentId: string): void => {
      if (dialog?.kind !== "move") return;
      const ids = dialog.entries.map(({ id }) => id);
      void runFilesystemChange(
        () => gateway.moveEntries(ids, {
            parentId,
            ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
              ? { desktopPlacement: desktopPlacement() }
              : {}),
          }),
        (result) => {
          applyBatchResult(result);
          setDialog(null);
        },
      );
    },
    [applyBatchResult, desktopPlacement, dialog, gateway, runFilesystemChange],
  );

  const uploadNodes = useCallback(
    (nodes: readonly LocalUploadNode[], parentId: string, notice?: string | null) =>
      upload.upload(
        nodes,
        parentId,
        parentId === FILESYSTEM_ROOT_ID.DESKTOP ? desktopPlacement() : undefined,
        notice,
      ),
    [desktopPlacement, upload],
  );

  return {
    revision,
    notifyChanged,
    entries,
    iconLayout,
    visibleEntries,
    selection,
    marquee,
    selectedEntries,
    upload,
    download,
    folderProperties,
    overflowCount,
    error: mutation.error,
    reportError: reportError,
    clearError: mutation.clearError,
    batchResult,
    setBatchResult,
    dialog,
    setDialog,
    dialogBusy: mutation.busy,
    desktopPlacement,
    synchronizeWidgetFile,
    removeWidgetWindows,
    handleDrop,
    trashEntries,
    dropOnSystemApp,
    dropOnEntry,
    createDirectory,
    renameEntry,
    moveDialogEntries,
    uploadNodes,
  } as const;
}
