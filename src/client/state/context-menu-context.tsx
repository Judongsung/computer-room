import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  XP_CONTEXT_MENU_CLASS_NAME,
  XP_CONTEXT_MENU_COMMAND_ID,
  XP_CONTEXT_MENU_COPY,
  XP_CONTEXT_MENU_EDITABLE_SELECTOR,
  XP_CONTEXT_MENU_ITEM_KIND,
  XP_CONTEXT_MENU_LAYOUT,
} from "../constants/context-menu";
import { KEYBOARD_KEY } from "../constants/keyboard";
import type {
  XpContextMenuController,
  XpContextMenuItem,
  XpContextMenuRequest,
} from "../types/context-menu";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "../domain/context-menu";

const XpContextMenuContext = createContext<XpContextMenuController | null>(
  null,
);

interface PreservedEditableTarget {
  readonly element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
  readonly range: Range | null;
}

export function XpContextMenuProvider({ children }: { readonly children: ReactNode }) {
  const [request, setRequest] = useState<XpContextMenuRequest | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editableTargetRef = useRef<PreservedEditableTarget | null>(null);

  const close = useCallback(() => setRequest(null), []);
  const reportError = useCallback((message: string) => setError(message), []);
  const open = useCallback((next: XpContextMenuRequest) => {
    setPosition({ x: next.x, y: next.y });
    setRequest(next);
  }, []);
  const openFromEvent = useCallback<XpContextMenuController["openFromEvent"]>(
    (event, items, label) => {
      event.preventDefault();
      event.stopPropagation();
      const semanticItems = semanticContextItems(
        event.target ?? null,
        editableTargetRef,
        reportError,
      );
      open({
        x: event.clientX,
        y: event.clientY,
        items: semanticItems ?? items,
        ...(label ? { label } : {}),
      });
    },
    [open, reportError],
  );

  const controller = useMemo<XpContextMenuController>(
    () => ({ open, openFromEvent, close, reportError }),
    [close, open, openFromEvent, reportError],
  );

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const items = fallbackItems(event.target, editableTargetRef, reportError);
      open({ x: event.clientX, y: event.clientY, items });
    };
    const handleKeyboardMenu = (event: KeyboardEvent): void => {
      if (
        event.key !== KEYBOARD_KEY.CONTEXT_MENU &&
        !(event.shiftKey && event.key === KEYBOARD_KEY.F10)
      ) {
        return;
      }
      event.preventDefault();
      const target = document.activeElement ?? document.body;
      const rect = target instanceof Element
        ? target.getBoundingClientRect()
        : document.body.getBoundingClientRect();
      target.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + Math.min(rect.width, 16),
          clientY: rect.bottom,
        }),
      );
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyboardMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyboardMenu);
    };
  }, [open, reportError]);

  useEffect(() => {
    if (!request) return undefined;
    const closeFromPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) {
        close();
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === KEYBOARD_KEY.ESCAPE) close();
    };
    const closeFromViewportChange = (): void => close();
    document.addEventListener("pointerdown", closeFromPointer, true);
    document.addEventListener("keydown", closeFromKeyboard);
    document.addEventListener("scroll", closeFromViewportChange, true);
    window.addEventListener("resize", closeFromViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      document.removeEventListener("scroll", closeFromViewportChange, true);
      window.removeEventListener("resize", closeFromViewportChange);
    };
  }, [close, request]);

  useEffect(() => {
    if (!request || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = XP_CONTEXT_MENU_LAYOUT.VIEWPORT_MARGIN_PX;
    setPosition({
      x: clampMenuCoordinate(request.x, rect.width, window.innerWidth, margin),
      y: clampMenuCoordinate(request.y, rect.height, window.innerHeight, margin),
    });
    focusMenuItem(menuRef.current, 0);
  }, [request]);

  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(
      () => setError(null),
      XP_CONTEXT_MENU_LAYOUT.ERROR_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [error]);

  return (
    <XpContextMenuContext.Provider value={controller}>
      {children}
      {request ? (
        <div
          ref={menuRef}
          className={XP_CONTEXT_MENU_CLASS_NAME.ROOT}
          role="menu"
          aria-label={request.label ?? XP_CONTEXT_MENU_COPY.LABEL}
          style={{
            left: position.x,
            top: position.y,
            width: XP_CONTEXT_MENU_LAYOUT.WIDTH_PX,
          }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={handleMenuKeyDown}
        >
          {request.items.map((item) =>
            item.kind === XP_CONTEXT_MENU_ITEM_KIND.SEPARATOR ? (
              <div
                key={item.id}
                className={XP_CONTEXT_MENU_CLASS_NAME.SEPARATOR}
                role="separator"
              />
            ) : (
              <button
                key={item.id}
                type="button"
                className={XP_CONTEXT_MENU_CLASS_NAME.ITEM}
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => void executeCommand(item, close, reportError)}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      {error ? (
        <div className={XP_CONTEXT_MENU_CLASS_NAME.ERROR} role="alert">
          {error}
        </div>
      ) : null}
    </XpContextMenuContext.Provider>
  );
}

export function useXpContextMenu(): XpContextMenuController {
  const value = useContext(XpContextMenuContext);
  if (!value) throw new Error("XpContextMenuProvider is required.");
  return value;
}

function fallbackItems(
  target: EventTarget | null,
  editableRef: { current: PreservedEditableTarget | null },
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  return semanticContextItems(target, editableRef, reportError) ?? defaultItems();
}

function semanticContextItems(
  target: EventTarget | null,
  editableRef: { current: PreservedEditableTarget | null },
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] | null {
  const element = target instanceof Element ? target : null;
  const editable = element?.closest(XP_CONTEXT_MENU_EDITABLE_SELECTOR);
  if (
    editable instanceof HTMLInputElement ||
    editable instanceof HTMLTextAreaElement ||
    editable instanceof HTMLElement && editable.isContentEditable
  ) {
    editableRef.current = preserveEditableTarget(editable);
    return editableItems(editableRef, reportError);
  }

  const anchor = element?.closest("a[href]");
  if (anchor instanceof HTMLAnchorElement) return linkItems(anchor, reportError);

  const selectedText = window.getSelection()?.toString() ?? "";
  if (selectedText) {
    return [
      contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.COPY, XP_CONTEXT_MENU_COPY.COPY, () =>
        writeClipboard(selectedText, reportError),
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL,
        XP_CONTEXT_MENU_COPY.SELECT_ALL,
        selectAllDocumentText,
      ),
    ];
  }
  return null;
}

function defaultItems(): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH_PAGE,
      XP_CONTEXT_MENU_COPY.REFRESH_PAGE,
      () => window.location.reload(),
    ),
  ];
}

function editableItems(
  targetRef: { current: PreservedEditableTarget | null },
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  const target = targetRef.current;
  const selectedText = target ? editableSelectionText(target) : "";
  const canModify = target ? canModifyEditable(target.element) : false;
  return [
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.CUT, XP_CONTEXT_MENU_COPY.CUT, async () => {
      if (!target) return;
      if (await writeClipboard(selectedText, reportError)) {
        replaceEditableSelection(target, "");
      }
    }, selectedText.length === 0 || !canModify),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.COPY, XP_CONTEXT_MENU_COPY.COPY, () =>
      writeClipboard(selectedText, reportError), selectedText.length === 0),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.PASTE, XP_CONTEXT_MENU_COPY.PASTE, async () => {
      if (!target) return;
      try {
        replaceEditableSelection(target, await navigator.clipboard.readText());
      } catch {
        reportError(XP_CONTEXT_MENU_COPY.CLIPBOARD_FAILED);
      }
    }, !canModify),
    contextMenuSeparator("edit-separator-1"),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.DELETE, XP_CONTEXT_MENU_COPY.DELETE, () => {
      if (target) replaceEditableSelection(target, "");
    }, selectedText.length === 0 || !canModify),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.SELECT_ALL, XP_CONTEXT_MENU_COPY.SELECT_ALL, () => {
      if (target) selectAllEditable(target);
    }),
  ];
}

function linkItems(
  anchor: HTMLAnchorElement,
  reportError: (message: string) => void,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.OPEN, XP_CONTEXT_MENU_COPY.OPEN, () => {
      window.location.assign(anchor.href);
    }),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.OPEN_NEW_WINDOW, XP_CONTEXT_MENU_COPY.OPEN_NEW_WINDOW, () => {
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }),
    contextMenuSeparator("link-separator-1"),
    contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.COPY_ADDRESS, XP_CONTEXT_MENU_COPY.COPY_ADDRESS, () =>
      writeClipboard(anchor.href, reportError),
    ),
  ];
}

function preserveEditableTarget(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
): PreservedEditableTarget {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return {
      element,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
      range: null,
    };
  }
  const selection = window.getSelection();
  return {
    element,
    selectionStart: null,
    selectionEnd: null,
    range: selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null,
  };
}

function canModifyEditable(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  return element.isContentEditable;
}

function editableSelectionText(target: PreservedEditableTarget): string {
  const { element, selectionStart, selectionEnd } = target;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return selectionStart === null || selectionEnd === null
      ? ""
      : element.value.slice(selectionStart, selectionEnd);
  }
  return target.range?.toString() ?? "";
}

function replaceEditableSelection(target: PreservedEditableTarget, value: string): void {
  const { element, selectionStart, selectionEnd } = target;
  element.focus();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = selectionStart ?? element.value.length;
    const end = selectionEnd ?? start;
    element.setRangeText(value, start, end, "end");
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    return;
  }
  const selection = window.getSelection();
  const range = target.range;
  if (!selection || !range) return;
  selection.removeAllRanges();
  selection.addRange(range);
  range.deleteContents();
  const node = document.createTextNode(value);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}

function selectAllEditable(target: PreservedEditableTarget): void {
  const { element } = target;
  element.focus();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectAllDocumentText(): void {
  const range = document.createRange();
  range.selectNodeContents(document.body);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

async function writeClipboard(text: string, reportError: (message: string) => void): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    reportError(XP_CONTEXT_MENU_COPY.CLIPBOARD_FAILED);
    return false;
  }
}

async function executeCommand(
  item: Extract<XpContextMenuItem, { readonly kind: "command" }>,
  close: () => void,
  reportError: (message: string) => void,
): Promise<void> {
  if (item.disabled) return;
  close();
  try {
    await item.onSelect();
  } catch (error) {
    reportError(error instanceof Error && error.message ? error.message : XP_CONTEXT_MENU_COPY.COMMAND_FAILED);
  }
}

function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
  const menu = event.currentTarget;
  const items = enabledMenuItems(menu);
  if (items.length === 0) return;
  const current = document.activeElement instanceof HTMLButtonElement
    ? items.indexOf(document.activeElement)
    : -1;
  let next: number | null = null;
  if (event.key === KEYBOARD_KEY.ARROW_DOWN) next = (current + 1) % items.length;
  else if (event.key === KEYBOARD_KEY.ARROW_UP) next = (current - 1 + items.length) % items.length;
  else if (event.key === KEYBOARD_KEY.HOME) next = 0;
  else if (event.key === KEYBOARD_KEY.END) next = items.length - 1;
  else if (event.key === KEYBOARD_KEY.ENTER || event.key === KEYBOARD_KEY.SPACE) {
    event.preventDefault();
    items[Math.max(0, current)]?.click();
    return;
  }
  if (next !== null) {
    event.preventDefault();
    items[next]?.focus();
  }
}

function focusMenuItem(menu: HTMLDivElement, index: number): void {
  enabledMenuItems(menu)[index]?.focus();
}

function enabledMenuItems(menu: HTMLDivElement): HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)"));
}

function clampMenuCoordinate(origin: number, size: number, viewport: number, margin: number): number {
  const flipped = origin + size + margin > viewport ? origin - size : origin;
  return Math.max(margin, Math.min(flipped, viewport - size - margin));
}
