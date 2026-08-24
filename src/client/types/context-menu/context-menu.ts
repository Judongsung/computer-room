import type { XP_CONTEXT_MENU_ITEM_KIND } from "@client/constants/context-menu/context-menu";

export interface XpContextMenuCommand {
  readonly kind: typeof XP_CONTEXT_MENU_ITEM_KIND.COMMAND;
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void | Promise<unknown>;
}

export interface XpContextMenuSeparator {
  readonly kind: typeof XP_CONTEXT_MENU_ITEM_KIND.SEPARATOR;
  readonly id: string;
}

export type XpContextMenuItem =
  | XpContextMenuCommand
  | XpContextMenuSeparator;

export interface XpContextMenuRequest {
  readonly x: number;
  readonly y: number;
  readonly items: readonly XpContextMenuItem[];
  readonly label?: string;
}

export interface XpContextMenuController {
  readonly open: (request: XpContextMenuRequest) => void;
  readonly openFromEvent: (
    event: {
      preventDefault: () => void;
      stopPropagation: () => void;
      clientX: number;
      clientY: number;
      target?: EventTarget | null;
    },
    items: readonly XpContextMenuItem[],
    label?: string,
  ) => void;
  readonly close: () => void;
  readonly reportError: (message: string) => void;
}
