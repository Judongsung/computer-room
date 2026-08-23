import { useEffect, useState, type CSSProperties } from "react";
import { FILESYSTEM_ENTRY_KIND } from "../../../constants/filesystem";
import { isThumbnailSourceSupported } from "../../../domain/thumbnail";
import type { FilesystemEntry } from "../../../types/filesystem";
import {
  DESKTOP_ASSET_PATHS,
  WIDGET_ICON_PATH_BY_TYPE,
} from "../../constants/desktop";

interface FilesystemEntryIconProps {
  readonly entry: FilesystemEntry;
  readonly thumbnailUrl: (id: string) => string;
}

export function FilesystemEntryIcon({
  entry,
  thumbnailUrl,
}: FilesystemEntryIconProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const fallbackPath = fallbackIconPath(entry);
  const canUseThumbnail =
    entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
    isThumbnailSourceSupported(entry.contentType, entry.size);

  useEffect(() => {
    setThumbnailFailed(false);
    setThumbnailLoaded(false);
  }, [entry.id, canUseThumbnail]);

  if (!canUseThumbnail || thumbnailFailed) {
    return <img src={fallbackPath} alt="" draggable={false} />;
  }

  return (
    <img
      className={
        thumbnailLoaded ? undefined : "filesystem-entry-icon--thumbnail-loading"
      }
      src={thumbnailUrl(entry.id)}
      alt=""
      draggable={false}
      style={thumbnailLoaded ? undefined : fallbackStyle(fallbackPath)}
      onLoad={() => setThumbnailLoaded(true)}
      onError={() => setThumbnailFailed(true)}
    />
  );
}

function fallbackStyle(fallbackPath: string): CSSProperties {
  return {
    "--filesystem-entry-fallback-icon": `url("${fallbackPath}")`,
  } as CSSProperties;
}

function fallbackIconPath(entry: FilesystemEntry): string {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
    return DESKTOP_ASSET_PATHS.FOLDER_ICON;
  }
  if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
    return WIDGET_ICON_PATH_BY_TYPE[entry.widgetType];
  }
  return DESKTOP_ASSET_PATHS.FILE_ICON;
}
