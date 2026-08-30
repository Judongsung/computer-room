import type { CSSProperties, ReactNode } from "react";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";
import { XP_EXPLORER_TOOLBAR_ACTION } from "@client/constants/filesystem/explorer-header";

export type XpExplorerToolbarAction =
  (typeof XP_EXPLORER_TOOLBAR_ACTION)[keyof typeof XP_EXPLORER_TOOLBAR_ACTION];

export interface XpExplorerMenu {
  readonly id: string;
  readonly label: string;
  readonly accessKey: string;
  readonly items: readonly XpContextMenuItem[];
}

export interface XpExplorerToolbarCommand {
  readonly action: XpExplorerToolbarAction;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void | Promise<unknown>;
}

export interface XpExplorerToolbarSeparator {
  readonly id: string;
  readonly separator: true;
}

export type XpExplorerToolbarItem =
  | XpExplorerToolbarCommand
  | XpExplorerToolbarSeparator;

export interface XpExplorerHeaderProps {
  readonly menus: readonly XpExplorerMenu[];
  readonly toolbarItems: readonly XpExplorerToolbarItem[];
  readonly locationIconPath: string;
  readonly address: ReactNode;
}

export type XpExplorerHeaderStyle = CSSProperties &
  Readonly<Record<`--xp-explorer-${string}`, string>>;
