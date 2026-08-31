import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_HEADER_CSS_VARIABLES,
} from "@client/constants/filesystem/explorer-header";
import type {
  XpExplorerAddressBarProps,
  XpExplorerHeaderStyle,
} from "@client/types/filesystem/explorer-header";

export function XpExplorerAddressBar({
  locationIconPath,
  address,
}: XpExplorerAddressBarProps) {
  return (
    <div
      className={XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_BAR}
      style={XP_EXPLORER_HEADER_CSS_VARIABLES as XpExplorerHeaderStyle}
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
  );
}
