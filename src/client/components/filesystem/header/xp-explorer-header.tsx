import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_HEADER_CSS_VARIABLES,
} from "@client/constants/filesystem/explorer-header";
import { XpExplorerMenuBar } from "@client/components/filesystem/header/xp-explorer-menu-bar";
import { XpExplorerToolbar } from "@client/components/filesystem/header/xp-explorer-toolbar";
import { XpExplorerAddressBar } from "@client/components/filesystem/header/xp-explorer-address-bar";
import type {
  XpExplorerHeaderProps,
  XpExplorerHeaderStyle,
} from "@client/types/filesystem/explorer-header";

export function XpExplorerHeader({
  menus,
  toolbarItems,
  locationIconPath,
  address,
}: XpExplorerHeaderProps) {
  return (
    <div
      className={XP_EXPLORER_HEADER_CLASS_NAME.ROOT}
      style={XP_EXPLORER_HEADER_CSS_VARIABLES as XpExplorerHeaderStyle}
    >
      <XpExplorerMenuBar menus={menus} />
      <XpExplorerToolbar items={toolbarItems} />
      <XpExplorerAddressBar
        locationIconPath={locationIconPath}
        address={address}
      />
    </div>
  );
}
