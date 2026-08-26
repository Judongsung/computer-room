import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import {
  MOBILE_ASSET_PATHS,
  MOBILE_WIDGET_ICON_PATH,
} from "@client/constants/shared/mobile";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileEntryIconProps {
  readonly entry: FilesystemEntry;
  readonly gateway: Pick<FilesystemGateway, "thumbnailUrl">;
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
    return MOBILE_WIDGET_ICON_PATH[entry.widgetType];
  }
  return MOBILE_ASSET_PATHS.FILE;
}
