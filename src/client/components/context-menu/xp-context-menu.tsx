import { XP_CONTEXT_MENU_COPY } from "@client/content/ko/context-menu/context-menu";
import type { RefObject } from "react";
import {
  XP_CONTEXT_MENU_CLASS_NAME,
  XP_CONTEXT_MENU_ITEM_KIND,
  XP_CONTEXT_MENU_LAYOUT,
} from "@client/constants/context-menu/context-menu";
import { messageFromError } from "@client/errors/error-message";
import { handleXpContextMenuKeyDown } from "@client/state/context-menu/context-menu-keyboard";
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
      style={{
        left: position.x,
        top: position.y,
        width: XP_CONTEXT_MENU_LAYOUT.WIDTH_PX,
      }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleXpContextMenuKeyDown}
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
    reportError(messageFromError(error, XP_CONTEXT_MENU_COPY.COMMAND_FAILED));
  }
}
