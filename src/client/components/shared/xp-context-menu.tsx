import type { KeyboardEvent, RefObject } from "react";
import {
  XP_CONTEXT_MENU_CLASS_NAME,
  XP_CONTEXT_MENU_COPY,
  XP_CONTEXT_MENU_ITEM_KIND,
  XP_CONTEXT_MENU_LAYOUT,
} from "@client/constants/context-menu/context-menu";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import type {
  XpContextMenuItem,
  XpContextMenuRequest,
} from "@client/types/context-menu/context-menu";

interface XpContextMenuProps {
  readonly request: XpContextMenuRequest;
  readonly position: { readonly x: number; readonly y: number };
  readonly menuRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
}

export function XpContextMenu({
  request,
  position,
  menuRef,
  onClose,
  onError,
}: XpContextMenuProps) {
  return (
    <div
      ref={menuRef}
      className={XP_CONTEXT_MENU_CLASS_NAME.ROOT}
      role="menu"
      aria-label={request.label ?? XP_CONTEXT_MENU_COPY.LABEL}
      style={{ left: position.x, top: position.y, width: XP_CONTEXT_MENU_LAYOUT.WIDTH_PX }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleMenuKeyDown}
    >
      {request.items.map((item) =>
        item.kind === XP_CONTEXT_MENU_ITEM_KIND.SEPARATOR ? (
          <div key={item.id} className={XP_CONTEXT_MENU_CLASS_NAME.SEPARATOR} role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            className={XP_CONTEXT_MENU_CLASS_NAME.ITEM}
            role="menuitem"
            tabIndex={-1}
            disabled={item.disabled}
            onClick={() => void executeCommand(item, onClose, onError)}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
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

function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  const items = enabledMenuItems(event.currentTarget);
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

export function focusXpContextMenuItem(menu: HTMLDivElement, index: number): void {
  enabledMenuItems(menu)[index]?.focus();
}

function enabledMenuItems(menu: HTMLDivElement): HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)"));
}
