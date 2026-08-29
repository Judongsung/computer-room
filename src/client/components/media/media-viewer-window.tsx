import { MEDIA_VIEWER_COPY, MEDIA_VIEWER_TITLE_BY_KIND } from "@client/content/ko/media/media";
import { useEffect } from "react";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import { MEDIA_KIND } from "@/constants/filesystem/media";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { MEDIA_WINDOW_CONFIG } from "@client/constants/media/media";
import { useMediaDirectory } from "@client/hooks/media/use-media-directory";
import type { MediaViewerWindowProps } from "@client/types/media/media";
import { downloadFile } from "@client/utils/download-file";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { PictureViewer } from "@client/components/media/picture-viewer";
import { WindowsMediaPlayer } from "@client/components/media/windows-media-player";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { contextMenuCommand, contextMenuSeparator } from "@client/domain/context-menu/context-menu";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { windowContextMenuItems } from "@client/domain/context-menu/window-context-menu";

export function MediaViewerWindow({
  window,
  desktop,
  gateway,
  filesystemRevision,
  isActive,
  zIndex,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCommitBounds,
  onChangeFile,
}: MediaViewerWindowProps) {
  const contextMenu = useXpContextMenu();
  const kind = mediaKindFromContentType(window.currentFile.contentType);
  const directory = useMediaDirectory(
    gateway,
    window.directoryId,
    filesystemRevision,
  );
  const currentIndex = directory.entries.findIndex(
    (entry) => entry.id === window.currentFile.id,
  );
  const hasPrevious = currentIndex > 0;
  const hasNext =
    currentIndex >= 0 && currentIndex < directory.entries.length - 1;

  useEffect(() => {
    const refreshed = directory.entries.find(
      (entry) => entry.id === window.currentFile.id,
    );
    if (
      refreshed &&
      (refreshed.name !== window.currentFile.name ||
        refreshed.contentType !== window.currentFile.contentType ||
        refreshed.size !== window.currentFile.size ||
        refreshed.parentId !== window.currentFile.parentId)
    ) {
      onChangeFile(refreshed);
    }
  }, [directory.entries, onChangeFile, window.currentFile]);

  if (!kind) {
    return null;
  }
  const config = MEDIA_WINDOW_CONFIG[kind];
  const navigate = (offset: number): void => {
    const next = directory.entries[currentIndex + offset];
    if (next) onChangeFile(next);
  };
  const rendererProps = {
    file: window.currentFile,
    sourceUrl: gateway.contentUrl(window.currentFile.id),
    navigationError: directory.error,
    hasPrevious: hasPrevious && !directory.isLoading,
    hasNext: hasNext && !directory.isLoading,
    onPrevious: () => navigate(-1),
    onNext: () => navigate(1),
    onDownload: () => downloadFile(gateway.downloadUrl(window.currentFile.id)),
    onContextMenu: (event: Parameters<typeof contextMenu.openFromEvent>[0]) =>
      contextMenu.openFromEvent(event, [
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
          MEDIA_VIEWER_COPY.DOWNLOAD_FILE,
          () => downloadFile(gateway.downloadUrl(window.currentFile.id)),
        ),
        contextMenuSeparator("media-viewer-separator-1"),
        ...windowContextMenuItems({
          isMaximized: window.windowState === WINDOW_STATE.MAXIMIZED,
          onMinimize,
          onToggleMaximize,
          onClose,
        }),
      ]),
  } as const;

  return (
    <DesktopAppWindow
      title={`${window.currentFile.name} - ${MEDIA_VIEWER_TITLE_BY_KIND[kind]}`}
      iconPath={config.iconPath}
      window={window}
      desktop={desktop}
      isActive={isActive}
      zIndex={zIndex}
      minWidth={config.minWidth}
      minHeight={config.minHeight}
      className={`media-viewer-window media-viewer-window--${kind}`}
      bodyClassName="media-viewer-window__body"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      onCommitBounds={onCommitBounds}
    >
      {kind === MEDIA_KIND.IMAGE ? (
        <PictureViewer {...rendererProps} />
      ) : (
        <WindowsMediaPlayer {...rendererProps} />
      )}
      {directory.isLoading ? (
        <span className="visually-hidden">{MEDIA_VIEWER_COPY.LOADING}</span>
      ) : null}
    </DesktopAppWindow>
  );
}
