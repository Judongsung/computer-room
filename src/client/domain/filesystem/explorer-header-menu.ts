import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type { FilesystemDirectorySort } from "@/types/filesystem/filesystem";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import {
  XP_EXPLORER_MENU_ACCESS_KEY,
  XP_EXPLORER_MENU_ID,
  XP_EXPLORER_SORT_DIRECTION_COMMAND_ID,
  XP_EXPLORER_SORT_FIELD_COMMAND_ID,
  XP_EXPLORER_TOOLBAR_ACTION,
} from "@client/constants/filesystem/explorer-header";
import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import {
  FILESYSTEM_SORT_DIRECTION_LABELS,
  FILESYSTEM_SORT_FIELD_OPTIONS,
} from "@client/content/ko/filesystem/sort";
import {
  FILESYSTEM_SORT_DIRECTION_VALUES,
} from "@/constants/filesystem/sort";
import {
  contextMenuCommand,
  contextMenuRadioCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import type {
  XpExplorerMenu,
  XpExplorerToolbarItem,
} from "@client/types/filesystem/explorer-header";

interface DocumentsHeaderState {
  readonly busy: boolean;
  readonly canGoBack: boolean;
  readonly canGoUp: boolean;
  readonly canMutate: boolean;
  readonly canDownload: boolean;
  readonly canRename: boolean;
  readonly canShowProperties: boolean;
  readonly hasSelection: boolean;
  readonly hasItems: boolean;
  readonly sort: FilesystemDirectorySort | null;
}
interface DocumentsHeaderActions {
  readonly goBack: () => void;
  readonly goUp: () => void;
  readonly createDirectory: () => void;
  readonly uploadFiles: () => void;
  readonly uploadFolder: () => void;
  readonly download: () => void | Promise<unknown>;
  readonly rename: () => void;
  readonly move: () => void;
  readonly delete: () => void | Promise<unknown>;
  readonly showProperties: () => void;
  readonly selectAll: () => void;
  readonly refresh: () => void | Promise<unknown>;
  readonly changeSort: (sort: FilesystemDirectorySort) => void | Promise<unknown>;
  readonly close: () => void;
}

export function buildDocumentsExplorerHeaderModel(
  state: DocumentsHeaderState,
  actions: DocumentsHeaderActions,
): {
  readonly menus: readonly XpExplorerMenu[];
  readonly toolbarItems: readonly XpExplorerToolbarItem[];
} {
  const mutationDisabled = !state.canMutate || state.busy;
  const selectionDisabled = !state.hasSelection || state.busy;
  const fileMenu = menu(XP_EXPLORER_MENU_ID.FILE, XP_EXPLORER_HEADER_COPY.FILE_MENU, [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.NEW_FOLDER,
      FILESYSTEM_COPY.NEW_FOLDER,
      actions.createDirectory,
      mutationDisabled,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FILES,
      FILESYSTEM_COPY.UPLOAD_FILES,
      actions.uploadFiles,
      mutationDisabled,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FOLDER,
      FILESYSTEM_COPY.UPLOAD_FOLDER,
      actions.uploadFolder,
      mutationDisabled,
    ),
    contextMenuSeparator("documents-file-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
      FILESYSTEM_COPY.DOWNLOAD,
      actions.download,
      !state.canDownload || state.busy,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.RENAME,
      FILESYSTEM_COPY.RENAME,
      actions.rename,
      !state.canRename || state.busy,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
      FOLDER_PROPERTIES_COPY.PROPERTIES,
      actions.showProperties,
      !state.canShowProperties || state.busy,
    ),
    contextMenuSeparator("documents-file-separator-2"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.CLOSE,
      FILESYSTEM_COPY.CLOSE,
      actions.close,
    ),
  ]);
  const editMenu = menu(XP_EXPLORER_MENU_ID.EDIT, XP_EXPLORER_HEADER_COPY.EDIT_MENU, [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.MOVE,
      FILESYSTEM_COPY.MOVE,
      actions.move,
      selectionDisabled,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.TRASH,
      FILESYSTEM_COPY.DELETE,
      actions.delete,
      selectionDisabled,
    ),
    contextMenuSeparator("documents-edit-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL,
      XP_EXPLORER_HEADER_COPY.SELECT_ALL,
      actions.selectAll,
      !state.hasItems || state.busy,
    ),
  ]);
  const effectiveSort = state.sort ?? DEFAULT_FILESYSTEM_DIRECTORY_SORT;
  const sortDisabled = !state.sort || state.busy;
  const viewMenu = menu(XP_EXPLORER_MENU_ID.VIEW, XP_EXPLORER_HEADER_COPY.VIEW_MENU, [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
      FILESYSTEM_COPY.REFRESH,
      actions.refresh,
      state.busy,
    ),
    contextMenuSeparator("documents-view-separator-1"),
    ...FILESYSTEM_SORT_FIELD_OPTIONS.map((option) =>
      contextMenuRadioCommand(
        XP_EXPLORER_SORT_FIELD_COMMAND_ID[option.value],
        option.label,
        () => actions.changeSort({
          field: option.value,
          direction: effectiveSort.direction,
        }),
        effectiveSort.field === option.value,
        sortDisabled,
      ),
    ),
    contextMenuSeparator("documents-view-separator-2"),
    ...FILESYSTEM_SORT_DIRECTION_VALUES.map((direction) =>
      contextMenuRadioCommand(
        XP_EXPLORER_SORT_DIRECTION_COMMAND_ID[direction],
        FILESYSTEM_SORT_DIRECTION_LABELS[effectiveSort.field][direction],
        () => actions.changeSort({ field: effectiveSort.field, direction }),
        effectiveSort.direction === direction,
        sortDisabled,
      ),
    ),
  ]);

  return {
    menus: [fileMenu, editMenu, viewMenu],
    toolbarItems: [
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.BACK, FILESYSTEM_COPY.BACK, actions.goBack, !state.canGoBack || state.busy),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.UP, FILESYSTEM_COPY.UP, actions.goUp, !state.canGoUp || state.busy),
      separator("documents-toolbar-separator-1"),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.NEW_FOLDER, FILESYSTEM_COPY.NEW_FOLDER, actions.createDirectory, mutationDisabled),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.UPLOAD_FILES, FILESYSTEM_COPY.UPLOAD_FILES, actions.uploadFiles, mutationDisabled),
      separator("documents-toolbar-separator-2"),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.DOWNLOAD, FILESYSTEM_COPY.DOWNLOAD, actions.download, !state.canDownload || state.busy),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.DELETE, FILESYSTEM_COPY.DELETE, actions.delete, selectionDisabled),
    ],
  };
}

interface RecycleHeaderState {
  readonly busy: boolean;
  readonly hasSelection: boolean;
  readonly hasItems: boolean;
}

interface RecycleHeaderActions {
  readonly restore: () => void | Promise<unknown>;
  readonly permanentlyDelete: () => void;
  readonly empty: () => void;
  readonly selectAll: () => void;
  readonly refresh: () => void | Promise<unknown>;
  readonly close: () => void;
}

export function buildRecycleExplorerHeaderModel(
  state: RecycleHeaderState,
  actions: RecycleHeaderActions,
): {
  readonly menus: readonly XpExplorerMenu[];
  readonly toolbarItems: readonly XpExplorerToolbarItem[];
} {
  const selectionDisabled = !state.hasSelection || state.busy;
  const emptyDisabled = !state.hasItems || state.busy;
  return {
    menus: [
      menu(XP_EXPLORER_MENU_ID.FILE, XP_EXPLORER_HEADER_COPY.FILE_MENU, [
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.RESTORE_FILES, FILESYSTEM_COPY.RESTORE, actions.restore, selectionDisabled),
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.PERMANENT_DELETE, FILESYSTEM_COPY.PERMANENT_DELETE, actions.permanentlyDelete, selectionDisabled),
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.EMPTY_RECYCLE_BIN, FILESYSTEM_COPY.EMPTY_RECYCLE_BIN, actions.empty, emptyDisabled),
        contextMenuSeparator("recycle-file-separator-1"),
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.CLOSE, FILESYSTEM_COPY.CLOSE, actions.close),
      ]),
      menu(XP_EXPLORER_MENU_ID.EDIT, XP_EXPLORER_HEADER_COPY.EDIT_MENU, [
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL, XP_EXPLORER_HEADER_COPY.SELECT_ALL, actions.selectAll, emptyDisabled),
      ]),
      menu(XP_EXPLORER_MENU_ID.VIEW, XP_EXPLORER_HEADER_COPY.VIEW_MENU, [
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.REFRESH, FILESYSTEM_COPY.REFRESH, actions.refresh, state.busy),
      ]),
    ],
    toolbarItems: [
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.RESTORE, FILESYSTEM_COPY.RESTORE, actions.restore, selectionDisabled),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.PERMANENT_DELETE, FILESYSTEM_COPY.PERMANENT_DELETE, actions.permanentlyDelete, selectionDisabled),
      separator("recycle-toolbar-separator-1"),
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.EMPTY_RECYCLE_BIN, FILESYSTEM_COPY.EMPTY_RECYCLE_BIN, actions.empty, emptyDisabled),
    ],
  };
}

export function buildMyComputerExplorerHeaderModel(
  selected: boolean,
  actions: { readonly runWidget: () => void; readonly close: () => void },
): {
  readonly menus: readonly XpExplorerMenu[];
  readonly toolbarItems: readonly XpExplorerToolbarItem[];
} {
  return {
    menus: [
      menu(XP_EXPLORER_MENU_ID.FILE, XP_EXPLORER_HEADER_COPY.FILE_MENU, [
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.OPEN, FILESYSTEM_COPY.RUN_WIDGET, actions.runWidget, !selected),
        contextMenuSeparator("my-computer-file-separator-1"),
        contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.CLOSE, FILESYSTEM_COPY.CLOSE, actions.close),
      ]),
    ],
    toolbarItems: [
      toolbar(XP_EXPLORER_TOOLBAR_ACTION.RUN_WIDGET, FILESYSTEM_COPY.RUN_WIDGET, actions.runWidget, !selected),
    ],
  };
}

function menu(
  id: keyof typeof XP_EXPLORER_MENU_ACCESS_KEY,
  label: string,
  items: XpExplorerMenu["items"],
): XpExplorerMenu {
  return { id, label, accessKey: XP_EXPLORER_MENU_ACCESS_KEY[id], items };
}

function toolbar(
  action: Extract<XpExplorerToolbarItem, { readonly action: string }>["action"],
  label: string,
  onSelect: () => void | Promise<unknown>,
  disabled = false,
): XpExplorerToolbarItem {
  return { action, label, onSelect, disabled };
}

function separator(id: string): XpExplorerToolbarItem {
  return { id, separator: true };
}
