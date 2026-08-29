import { XP_CONTEXT_MENU_COPY } from "@client/content/ko/context-menu/context-menu";
import {
  XP_CONTEXT_MENU_COMMAND_ID,
  XP_CONTEXT_MENU_EDITABLE_SELECTOR,
} from "@client/constants/context-menu/context-menu";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import {
  canModifyEditable,
  editableSelectionText,
  preserveEditableTarget,
  replaceEditableSelection,
  selectAllDocumentText,
  selectAllEditable,
  type PreservedEditableTarget,
} from "@client/state/context-menu/editable-selection";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";

interface EditableTargetRef {
  current: PreservedEditableTarget | null;
}

export function fallbackContextMenuItems(
  target: EventTarget | null,
  editableRef: EditableTargetRef,
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  return (
    semanticContextMenuItems(target, editableRef, reportError) ??
    defaultContextMenuItems()
  );
}

export function semanticContextMenuItems(
  target: EventTarget | null,
  editableRef: EditableTargetRef,
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] | null {
  const element = target instanceof Element ? target : null;
  const editable = element?.closest(XP_CONTEXT_MENU_EDITABLE_SELECTOR);
  if (
    editable instanceof HTMLInputElement ||
    editable instanceof HTMLTextAreaElement ||
    (editable instanceof HTMLElement && editable.isContentEditable)
  ) {
    editableRef.current = preserveEditableTarget(editable);
    return editableContextMenuItems(editableRef, reportError);
  }

  const anchor = element?.closest("a[href]");
  if (anchor instanceof HTMLAnchorElement) {
    return linkContextMenuItems(anchor, reportError);
  }

  const selectedText = window.getSelection()?.toString() ?? "";
  if (!selectedText) return null;
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.COPY,
      XP_CONTEXT_MENU_COPY.COPY,
      () => writeClipboard(selectedText, reportError),
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL,
      XP_CONTEXT_MENU_COPY.SELECT_ALL,
      selectAllDocumentText,
    ),
  ];
}

function defaultContextMenuItems(): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH_PAGE,
      XP_CONTEXT_MENU_COPY.REFRESH_PAGE,
      () => window.location.reload(),
    ),
  ];
}

function editableContextMenuItems(
  targetRef: EditableTargetRef,
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  const target = targetRef.current;
  const selectedText = target ? editableSelectionText(target) : "";
  const canModify = target ? canModifyEditable(target) : false;
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.CUT,
      XP_CONTEXT_MENU_COPY.CUT,
      async () => {
        if (!target) return;
        if (await writeClipboard(selectedText, reportError)) {
          replaceEditableSelection(target, "");
        }
      },
      selectedText.length === 0 || !canModify,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.COPY,
      XP_CONTEXT_MENU_COPY.COPY,
      () => writeClipboard(selectedText, reportError),
      selectedText.length === 0,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.PASTE,
      XP_CONTEXT_MENU_COPY.PASTE,
      async () => {
        if (!target) return;
        try {
          replaceEditableSelection(target, await navigator.clipboard.readText());
        } catch {
          reportError(XP_CONTEXT_MENU_COPY.CLIPBOARD_FAILED);
        }
      },
      !canModify,
    ),
    contextMenuSeparator("edit-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.DELETE,
      XP_CONTEXT_MENU_COPY.DELETE,
      () => {
        if (target) replaceEditableSelection(target, "");
      },
      selectedText.length === 0 || !canModify,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL,
      XP_CONTEXT_MENU_COPY.SELECT_ALL,
      () => {
        if (target) selectAllEditable(target);
      },
    ),
  ];
}

function linkContextMenuItems(
  anchor: HTMLAnchorElement,
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.OPEN,
      XP_CONTEXT_MENU_COPY.OPEN,
      () => window.location.assign(anchor.href),
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.OPEN_NEW_WINDOW,
      XP_CONTEXT_MENU_COPY.OPEN_NEW_WINDOW,
      () => {
        window.open(anchor.href, "_blank", "noopener,noreferrer");
      },
    ),
    contextMenuSeparator("link-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.COPY_ADDRESS,
      XP_CONTEXT_MENU_COPY.COPY_ADDRESS,
      () => writeClipboard(anchor.href, reportError),
    ),
  ];
}

async function writeClipboard(
  text: string,
  reportError: (message: string) => void,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    reportError(XP_CONTEXT_MENU_COPY.CLIPBOARD_FAILED);
    return false;
  }
}
