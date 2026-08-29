import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import {
  MOBILE_ASSET_PATHS,
  MOBILE_WIDGET_ICON_PATH,
} from "@client/constants/mobile/assets";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";

interface MobileEntryIconProps {
  readonly entry: FilesystemEntry;
  readonly gateway: Pick<FilesystemContentGateway, "thumbnailUrl">;
}

export function MobileEntryIcon({ entry, gateway }: MobileEntryIconProps) {
  return (
    <FilesystemEntryIcon
      entry={entry}
      thumbnailUrl={(id) => gateway.thumbnailUrl(id)}
      fallbackPath={mobileFallbackPath(entry)}
    />
  );
}

function mobileFallbackPath(entry: FilesystemEntry): string {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
    return MOBILE_ASSET_PATHS.FOLDER;
  }
  if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
    return isMobileWidgetIconType(entry.widgetType)
      ? MOBILE_WIDGET_ICON_PATH[entry.widgetType]
      : MOBILE_ASSET_PATHS.FILE;
  }
  return MOBILE_ASSET_PATHS.FILE;
}

function isMobileWidgetIconType(
  type: string,
): type is keyof typeof MOBILE_WIDGET_ICON_PATH {
  return Object.hasOwn(MOBILE_WIDGET_ICON_PATH, type);
}
