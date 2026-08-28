import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  isPotentialMediaContentType,
  mediaKindFromContentType,
} from "@/domain/filesystem/media-type";
import type {
  FilesystemDirectorySort,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import {
  FILE_PICKER_ABORT_ERROR_NAME,
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
} from "@client/constants/filesystem/filesystem";
import {
  collectDroppedUploadNodes,
  collectSelectedUploadNodes,
  selectDirectoryUploadNode,
  supportsDirectoryHandlePicker,
} from "@client/domain/filesystem/local-file-tree";
import {
  readFilesystemDragPayload,
} from "@client/domain/filesystem/drag";
import {
  buildExplorerDirectoryContextMenu,
  buildExplorerEntryContextMenu,
} from "@client/domain/filesystem/explorer-context-menu";
import { messageFromError } from "@client/errors/error-message";
import { useDirectoryExplorer } from "@client/hooks/filesystem/directory/use-directory-explorer";
import { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import type { DocumentsDialog, DocumentsWindowProps } from "@client/types/filesystem/explorer";
import { downloadFile } from "@client/utils/download-file";

const EMPTY_ENTRY_IDS: readonly string[] = [];

type DocumentsControllerOptions = Pick<
  DocumentsWindowProps,
  | "gateway"
  | "windowId"
  | "initialDirectoryId"
  | "filesystemRevision"
  | "onFilesystemChanged"
  | "onDirectoryChanged"
  | "onOpenMedia"
  | "onOpenWidget"
  | "onEntryChanged"
  | "onWidgetsClosed"
  | "onUploadNodes"
  | "desktopCapacity"
>;

export function useDocumentsController(options: DocumentsControllerOptions) {
  const {
    gateway,
    onFilesystemChanged,
    onEntryChanged,
    onWidgetsClosed,
    desktopCapacity,
  } = options;
  const contextMenu = useXpContextMenu();
  const explorer = useDirectoryExplorer({
    gateway,
    initialDirectoryId: options.initialDirectoryId,
    revision: options.filesystemRevision,
    windowId: options.windowId,
    onDirectoryChanged: options.onDirectoryChanged,
    onFilesystemChanged,
  });
  const [mutationBusy, setMutationBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DocumentsDialog>(null);
  const [unsupportedMedia, setUnsupportedMedia] = useState<FilesystemEntry | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(
    () => explorer.page?.items.map((item) => item.id) ?? EMPTY_ENTRY_IDS,
    [explorer.page?.items],
  );
  const selection = useFilesystemSelection(itemIds);
  const marquee = useFilesystemMarqueeSelection(
    contentRef,
    selection.selectedIds,
    selection.replace,
  );
  const download = useFilesystemDownload(gateway);
  const folderProperties = useFolderProperties(gateway);
  const selectedEntries = useMemo(
    () =>
      explorer.page?.items.filter((item) => selection.selectedIds.has(item.id)) ?? [],
    [explorer.page?.items, selection.selectedIds],
  );
  const selected = selectedEntries.length === 1 ? selectedEntries[0] ?? null : null;
  const selectedDirectory =
    selected?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ? selected : null;
  const propertiesTarget =
    selectedEntries.length === 0 ? explorer.page?.directory ?? null : selectedDirectory;
  const currentDirectoryId = explorer.page?.directory.id;
  const busy = mutationBusy || explorer.isLoadingMore;

  const runChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setMutationBusy(true);
      setOperationError(null);
      try {
        await operation();
        setDialog(null);
        selection.clear();
        onFilesystemChanged();
      } catch (reason) {
        setOperationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setMutationBusy(false);
      }
    },
    [onFilesystemChanged, selection.clear],
  );

  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>): Promise<void> => {
      setMutationBusy(true);
      setOperationError(null);
      try {
        const result = await operation();
        result.entries.forEach(onEntryChanged);
        onWidgetsClosed(result.closedWidgetIds);
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        selection.replace(result.failures.map((failure) => failure.id));
        onFilesystemChanged();
      } catch (reason) {
        setOperationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setMutationBusy(false);
      }
    },
    [onEntryChanged, onFilesystemChanged, onWidgetsClosed, selection.replace],
  );

  const changeSort = useCallback(
    async (sort: FilesystemDirectorySort): Promise<void> => {
      if (!currentDirectoryId || busy) return;
      setMutationBusy(true);
      setOperationError(null);
      try {
        await explorer.changeSort(sort);
        selection.clear();
        if (contentRef.current) contentRef.current.scrollTop = 0;
      } catch (reason) {
        setOperationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setMutationBusy(false);
      }
    },
    [busy, currentDirectoryId, explorer.changeSort, selection.clear],
  );

  const openEntry = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        explorer.navigate(entry.id);
      } else if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
        options.onOpenWidget(entry.widgetId);
      } else {
        const kind = mediaKindFromContentType(entry.contentType);
        if (kind) options.onOpenMedia({ entry, directoryId: entry.parentId, kind });
        else if (isPotentialMediaContentType(entry.contentType)) setUnsupportedMedia(entry);
        else downloadFile(gateway.downloadUrl(entry.id));
      }
    },
    [explorer.navigate, gateway, options.onOpenMedia, options.onOpenWidget],
  );

  const uploadSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const files = event.target.files;
      event.target.value = "";
      if (files && files.length > 0 && currentDirectoryId) {
        void options.onUploadNodes(collectSelectedUploadNodes(files), currentDirectoryId);
      }
    },
    [currentDirectoryId, options.onUploadNodes],
  );

  const selectFolder = useCallback((): void => {
    if (!currentDirectoryId) return;
    if (!supportsDirectoryHandlePicker()) {
      folderInputRef.current?.click();
      return;
    }
    void selectDirectoryUploadNode()
      .then((node) =>
        node
          ? options.onUploadNodes([node], currentDirectoryId)
          : folderInputRef.current?.click(),
      )
      .catch((reason: unknown) => {
        if (!isPickerCancellation(reason)) {
          setOperationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
        }
      });
  }, [currentDirectoryId, options.onUploadNodes]);

  const dropIntoDirectory = useCallback(
    (event: DragEvent, parentId: string): void => {
      event.preventDefault();
      event.stopPropagation();
      setDropTargetId(null);
      const payload = readFilesystemDragPayload(event.dataTransfer);
      if (payload) {
        void runBatchChange(() =>
          payload.source === FILESYSTEM_DRAG_SOURCE.TRASH
            ? gateway.restoreEntries(payload.ids, moveInput(parentId, desktopCapacity))
            : gateway.moveEntries(payload.ids, moveInput(parentId, desktopCapacity)),
        );
        return;
      }
      void collectDroppedUploadNodes(event.dataTransfer.items)
        .then((upload) =>
          options.onUploadNodes(
            upload.nodes,
            parentId,
            upload.folderDropUnsupported ? FILESYSTEM_COPY.FOLDER_DROP_UNSUPPORTED : null,
          ),
        )
        .catch((reason: unknown) =>
          setOperationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED)),
        );
    },
    [desktopCapacity, gateway, options.onUploadNodes, runBatchChange],
  );

  const openEntryContextMenu = useCallback(
    (entry: FilesystemEntry, event: ContextMenuEvent): void => {
      const entries = selection.selectedIds.has(entry.id) ? selectedEntries : [entry];
      if (!selection.selectedIds.has(entry.id)) selection.replace([entry.id]);
      contextMenu.openFromEvent(
        event,
        buildExplorerEntryContextMenu(entries, {
          open: () => openEntry(entries[0] ?? entry),
          download: () => download.start(entries),
          rename: () => setDialog("rename"),
          move: () => setDialog("move"),
          trash: () => runBatchChange(() => gateway.trashEntries(entries.map(({ id }) => id))),
          showProperties: () => {
            const directory = entries[0];
            if (directory?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
              folderProperties.open(directory);
            }
          },
        }),
      );
    },
    [contextMenu, download, folderProperties, gateway, openEntry, runBatchChange, selectedEntries, selection],
  );

  const openDirectoryContextMenu = useCallback(
    (event: ContextMenuEvent): void => {
      contextMenu.openFromEvent(
        event,
        buildExplorerDirectoryContextMenu(
          { canMutate: Boolean(currentDirectoryId), busy, hasPage: Boolean(explorer.page) },
          {
            createDirectory: () => setDialog("create"),
            uploadFiles: () => fileInputRef.current?.click(),
            uploadFolder: selectFolder,
            refresh: onFilesystemChanged,
            showProperties: () => {
              if (explorer.page) folderProperties.open(explorer.page.directory);
            },
          },
        ),
      );
    },
    [busy, contextMenu, currentDirectoryId, explorer.page, folderProperties, onFilesystemChanged, selectFolder],
  );

  return {
    explorer,
    page: explorer.page,
    error: operationError ?? explorer.error,
    busy,
    dialog,
    unsupportedMedia,
    dropTargetId,
    batchResult,
    fileInputRef,
    folderInputRef,
    contentRef,
    selection,
    marquee,
    download,
    folderProperties,
    selectedEntries,
    selected,
    selectedDirectory,
    propertiesTarget,
    currentDirectoryId,
    setDialog,
    setUnsupportedMedia,
    setDropTargetId,
    setBatchResult,
    runChange,
    runBatchChange,
    changeSort,
    openEntry,
    uploadSelection,
    selectFolder,
    dropIntoDirectory,
    openEntryContextMenu,
    openDirectoryContextMenu,
  } as const;
}

interface ContextMenuEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
  clientX: number;
  clientY: number;
}

function moveInput(parentId: string, desktopCapacity: number) {
  return {
    parentId,
    ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
      ? { desktopPlacement: { targetIndex: 0, capacity: desktopCapacity } }
      : {}),
  };
}

function isPickerCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === FILE_PICKER_ABORT_ERROR_NAME;
}
