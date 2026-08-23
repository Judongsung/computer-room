import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FILESYSTEM_ENTRY_KIND } from "../../../constants/filesystem";
import { isThumbnailSourceSupported } from "../../../domain/thumbnail";
import type { FilesystemEntry } from "../../../types/filesystem";
import {
  DESKTOP_ASSET_PATHS,
  WIDGET_ICON_PATH_BY_TYPE,
} from "../../constants/desktop";
import { THUMBNAIL_LOAD_POLICY } from "../../constants/thumbnail";
import { useThumbnailLoadScheduler } from "../../state/thumbnail-load-context";
import type { ThumbnailLoadPermit } from "../../types/thumbnail";

interface FilesystemEntryIconProps {
  readonly entry: FilesystemEntry;
  readonly thumbnailUrl: (id: string) => string;
}

export function FilesystemEntryIcon({
  entry,
  thumbnailUrl,
}: FilesystemEntryIconProps) {
  const scheduler = useThumbnailLoadScheduler();
  const imageRef = useRef<HTMLImageElement>(null);
  const permitRef = useRef<ThumbnailLoadPermit | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [thumbnailVisible, setThumbnailVisible] = useState(false);
  const [thumbnailRequested, setThumbnailRequested] = useState(false);
  const fallbackPath = fallbackIconPath(entry);
  const canUseThumbnail =
    entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
    isThumbnailSourceSupported(entry.contentType, entry.size);

  useEffect(() => {
    setThumbnailFailed(false);
    setThumbnailLoaded(false);
    setThumbnailVisible(false);
    setThumbnailRequested(false);
  }, [entry.id, canUseThumbnail]);

  useEffect(() => {
    if (!canUseThumbnail || thumbnailFailed) return;
    const image = imageRef.current;
    if (!image || typeof IntersectionObserver === "undefined") {
      setThumbnailVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((candidate) => candidate.isIntersecting)) {
          setThumbnailVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: THUMBNAIL_LOAD_POLICY.INTERSECTION_ROOT_MARGIN },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [entry.id, canUseThumbnail, thumbnailFailed]);

  useEffect(() => {
    if (!canUseThumbnail || !thumbnailVisible || thumbnailFailed) return;
    const controller = new AbortController();
    void scheduler.acquire(controller.signal).then((permit) => {
      if (!permit) return;
      permitRef.current = permit;
      setThumbnailRequested(true);
    });
    return () => {
      controller.abort();
      releasePermit(permitRef);
    };
  }, [entry.id, canUseThumbnail, scheduler, thumbnailFailed, thumbnailVisible]);

  if (!canUseThumbnail || thumbnailFailed) {
    return <img ref={imageRef} src={fallbackPath} alt="" draggable={false} />;
  }

  if (!thumbnailRequested) {
    return <img ref={imageRef} src={fallbackPath} alt="" draggable={false} />;
  }

  return (
    <img
      ref={imageRef}
      className={
        thumbnailLoaded ? undefined : "filesystem-entry-icon--thumbnail-loading"
      }
      src={thumbnailUrl(entry.id)}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      style={thumbnailLoaded ? undefined : fallbackStyle(fallbackPath)}
      onLoad={() => {
        releasePermit(permitRef);
        setThumbnailLoaded(true);
      }}
      onError={() => {
        releasePermit(permitRef);
        setThumbnailFailed(true);
      }}
    />
  );
}

function releasePermit(
  permitRef: { current: ThumbnailLoadPermit | null },
): void {
  permitRef.current?.release();
  permitRef.current = null;
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
