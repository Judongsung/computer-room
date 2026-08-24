import { XP_CONTEXT_MENU_ITEM_KIND } from "@client/constants/context-menu/context-menu";
import type {
  XpContextMenuCommand,
  XpContextMenuItem,
} from "@client/types/context-menu/context-menu";

export function contextMenuCommand(
  id: string,
  label: string,
  onSelect: () => void | Promise<unknown>,
  disabled = false,
): XpContextMenuCommand {
  return {
    kind: XP_CONTEXT_MENU_ITEM_KIND.COMMAND,
    id,
    label,
    onSelect,
    disabled,
  };
}

export function contextMenuSeparator(id: string): XpContextMenuItem {
  return { kind: XP_CONTEXT_MENU_ITEM_KIND.SEPARATOR, id };
}
