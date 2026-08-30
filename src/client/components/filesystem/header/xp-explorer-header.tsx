import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_HEADER_CSS_VARIABLES,
} from "@client/constants/filesystem/explorer-header";
import { XpExplorerMenuBar } from "@client/components/filesystem/header/xp-explorer-menu-bar";
import { XpExplorerToolbar } from "@client/components/filesystem/header/xp-explorer-toolbar";
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
      <div
        className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_BAR}
        aria-label={XP_EXPLORER_HEADER_COPY.ADDRESS_BAR}
      >
        <span className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_LABEL}>
          {XP_EXPLORER_HEADER_COPY.ADDRESS_LABEL}
        </span>
        <div className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_FIELD}>
          <img
            className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_ICON}
            src={locationIconPath}
            alt=""
            draggable={false}
          />
          <div className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_VALUE}>
            {address}
          </div>
        </div>
      </div>
    </div>
  );
}
