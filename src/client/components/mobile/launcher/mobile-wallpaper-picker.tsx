import { useEffect, useRef, useState } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { MEDIA_KIND } from "@/constants/filesystem/media";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectoryEntry,
  FilesystemEntry,
  FilesystemFileEntry,
} from "@/types/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileWallpaperPickerProps {
  readonly currentWallpaper: FilesystemFileEntry | null;
  readonly loadingPreferences: boolean;
  readonly saving: boolean;
  readonly preferenceError: string | null;
  readonly filesystem: FilesystemGateway;
  readonly onApply: (entryId: string | null) => Promise<boolean>;
  readonly onApplied: () => void;
  readonly onRetryPreferences: () => Promise<void>;
}

interface WallpaperDirectory {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly items: readonly (FilesystemDirectoryEntry | FilesystemFileEntry)[];
  readonly nextOffset: number | null;
}

export function MobileWallpaperPicker({
  currentWallpaper,
  loadingPreferences,
  saving,
  preferenceError,
  filesystem,
  onApply,
  onApplied,
  onRetryPreferences,
}: MobileWallpaperPickerProps) {
  const selectionChanged = useRef(false);
  const [directoryId, setDirectoryId] = useState(
    currentWallpaper?.parentId ?? FILESYSTEM_ROOT_ID.DESKTOP,
  );
  const [directory, setDirectory] = useState<WallpaperDirectory | null>(null);
  const [selected, setSelected] = useState<FilesystemFileEntry | null>(
    currentWallpaper,
  );
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(currentWallpaper === null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingPreferences || selectionChanged.current || !currentWallpaper) {
      return;
    }
    setDirectoryId(currentWallpaper.parentId);
    setSelected(currentWallpaper);
    setPreviewReady(false);
    setPreviewError(null);
  }, [currentWallpaper, loadingPreferences]);

  useEffect(() => {
    let active = true;
    setLoadingDirectory(true);
    void filesystem.listDirectory(directoryId).then(
      (page) => {
        if (!active) return;
        setDirectory({
          directory: page.directory,
          breadcrumbs: page.breadcrumbs,
          items: page.items.filter(isWallpaperBrowserEntry),
          nextOffset: page.nextOffset,
        });
        setDirectoryError(null);
        setLoadingDirectory(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setDirectoryError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
        setLoadingDirectory(false);
      },
    );
    return () => {
      active = false;
    };
  }, [directoryId, filesystem]);

  const chooseWallpaper = (entry: FilesystemFileEntry | null): void => {
    selectionChanged.current = true;
    setSelected(entry);
    setPreviewReady(entry === null);
    setPreviewError(null);
  };

  const loadMore = async (): Promise<void> => {
    if (!directory || directory.nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await filesystem.listDirectory(
        directoryId,
        directory.nextOffset,
      );
      setDirectory({
        directory: page.directory,
        breadcrumbs: page.breadcrumbs,
        items: [
          ...directory.items,
          ...page.items.filter(isWallpaperBrowserEntry),
        ],
        nextOffset: page.nextOffset,
      });
      setDirectoryError(null);
    } catch (caught) {
      setDirectoryError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
    } finally {
      setLoadingMore(false);
    }
  };

  const apply = async (): Promise<void> => {
    if (saving || (selected !== null && !previewReady)) return;
    if (await onApply(selected?.id ?? null)) onApplied();
  };

  return (
    <MobileActivity title={MOBILE_COPY.WALLPAPER}>
      <div className={MOBILE_CLASS_NAME.WALLPAPER}>
        <div className={MOBILE_CLASS_NAME.WALLPAPER_ROOTS}>
          <button
            type="button"
            onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DESKTOP)}
          >
            {MOBILE_COPY.HOME_SCREEN}
          </button>
          <button
            type="button"
            onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DOCUMENTS)}
          >
            {MOBILE_COPY.MY_DOCUMENTS}
          </button>
        </div>

        <section
          className={MOBILE_CLASS_NAME.WALLPAPER_PREVIEW}
          aria-label={MOBILE_COPY.WALLPAPER_PREVIEW}
        >
          {selected ? (
            <img
              key={selected.id}
              className={MOBILE_CLASS_NAME.WALLPAPER_PREVIEW_IMAGE}
              src={filesystem.contentUrl(selected.id)}
              alt={selected.name}
              decoding="async"
              onLoad={() => {
                setPreviewReady(true);
                setPreviewError(null);
              }}
              onError={() => {
                setPreviewReady(false);
                setPreviewError(MOBILE_COPY.WALLPAPER_PREVIEW_FAILED);
              }}
            />
          ) : (
            <div className={MOBILE_CLASS_NAME.WALLPAPER_PREVIEW_DEFAULT}>
              {MOBILE_COPY.DEFAULT_WALLPAPER}
            </div>
          )}
        </section>

        <button
          className={MOBILE_CLASS_NAME.WALLPAPER_DEFAULT}
          type="button"
          aria-pressed={selected === null}
          onClick={() => chooseWallpaper(null)}
        >
          {MOBILE_COPY.USE_DEFAULT_WALLPAPER}
        </button>

        {directory ? (
          <nav
            className={MOBILE_CLASS_NAME.BREADCRUMBS}
            aria-label={MOBILE_COPY.CURRENT_PATH}
          >
            {directory.breadcrumbs.map((breadcrumb, index) => (
              <span key={breadcrumb.id}>
                {index > 0 ? "›" : null}
                <button
                  type="button"
                  onClick={() => setDirectoryId(breadcrumb.id)}
                >
                  {breadcrumb.name}
                </button>
              </span>
            ))}
          </nav>
        ) : null}

        {loadingDirectory && !directory ? (
          <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
        ) : null}
        {directoryError ? (
          <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
            {directoryError}
          </p>
        ) : null}
        {directory && directory.items.length === 0 ? (
          <p className={MOBILE_CLASS_NAME.MESSAGE}>
            {MOBILE_COPY.NO_WALLPAPER_IMAGES}
          </p>
        ) : null}
        {directory?.items.length ? (
          <ul className={MOBILE_CLASS_NAME.LIST}>
            {directory.items.map((entry) => (
              <li key={entry.id}>
                <button
                  className={`${MOBILE_CLASS_NAME.LIST_ITEM}${
                    selected?.id === entry.id
                      ? ` ${MOBILE_CLASS_NAME.WALLPAPER_SELECTED}`
                      : ""
                  }`}
                  type="button"
                  aria-label={entry.name}
                  aria-pressed={
                    entry.kind === FILESYSTEM_ENTRY_KIND.FILE
                      ? selected?.id === entry.id
                      : undefined
                  }
                  onClick={() =>
                    entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
                      ? setDirectoryId(entry.id)
                      : chooseWallpaper(entry)
                  }
                >
                  <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                    <MobileEntryIcon entry={entry} gateway={filesystem} />
                  </span>
                  <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                    <strong>{entry.name}</strong>
                    <small className={MOBILE_CLASS_NAME.LIST_META}>
                      {entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
                        ? MOBILE_COPY.DIRECTORY_KIND
                        : entry.contentType}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {directory?.nextOffset !== null &&
        directory?.nextOffset !== undefined ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
          </button>
        ) : null}

        {loadingPreferences ? (
          <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
        ) : null}
        {previewError ? (
          <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
            {previewError}
          </p>
        ) : null}
        {preferenceError ? (
          <div className={MOBILE_CLASS_NAME.WALLPAPER_ERROR}>
            <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
              {preferenceError}
            </p>
            <button type="button" onClick={() => void onRetryPreferences()}>
              {MOBILE_COPY.RETRY}
            </button>
          </div>
        ) : null}

        <div className={MOBILE_CLASS_NAME.WALLPAPER_ACTIONS}>
          <button
            type="button"
            disabled={
              saving ||
              loadingPreferences ||
              (selected !== null && !previewReady)
            }
            onClick={() => void apply()}
          >
            {saving ? MOBILE_COPY.SAVING : MOBILE_COPY.SET_WALLPAPER}
          </button>
        </div>
      </div>
    </MobileActivity>
  );
}

function isWallpaperBrowserEntry(
  entry: FilesystemEntry,
): entry is FilesystemDirectoryEntry | FilesystemFileEntry {
  return (
    entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ||
    (entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
      mediaKindFromContentType(entry.contentType) === MEDIA_KIND.IMAGE)
  );
}
