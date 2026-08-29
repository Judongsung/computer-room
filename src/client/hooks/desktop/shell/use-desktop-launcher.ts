import { useCallback } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { WidgetType } from "@/types/widgets/widget";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "@client/constants/desktop/system-app";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import type { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import type { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import type { useMediaWindows } from "@client/hooks/media/use-media-windows";
import type { DesktopDimensions } from "@client/types/desktop/desktop";
import type { SystemAppId } from "@client/types/desktop/system-app";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";
import { downloadFile } from "@client/utils/download-file";

interface DesktopLauncherOptions {
  readonly desktop: DesktopDimensions;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly filesystem: Pick<FilesystemContentGateway, "downloadUrl">;
  readonly focusWindow: (id: string, persist?: () => void) => void;
  readonly closeStartMenu: () => void;
  readonly onAddWidget: (type: WidgetType, desktop: DesktopDimensions) => Promise<void>;
  readonly onOpenWidget: (widgetId: string) => Promise<void>;
}

export function useDesktopLauncher({
  desktop,
  system,
  explorer,
  media,
  filesystem,
  focusWindow,
  closeStartMenu,
  onAddWidget,
  onOpenWidget,
}: DesktopLauncherOptions) {
  const addWidget = useCallback(
    (type: WidgetType): void => {
      void onAddWidget(type, desktop);
      closeStartMenu();
    },
    [closeStartMenu, desktop, onAddWidget],
  );

  const openSystemApp = useCallback(
    (id: SystemAppId): void => {
      system.open(id);
      focusWindow(id);
    },
    [focusWindow, system],
  );

  const openDocumentsDirectory = useCallback(
    (directoryId: string, title: string, iconPath: string): void => {
      const id = explorer.open({ directoryId, title, iconPath }, desktop);
      focusWindow(id);
    },
    [desktop, explorer, focusWindow],
  );

  const openSystemShortcut = useCallback(
    (id: SystemAppId): void => {
      if (id === SYSTEM_APP_ID.DOCUMENTS) {
        const config = SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS];
        openDocumentsDirectory(
          FILESYSTEM_ROOT_ID.DOCUMENTS,
          SYSTEM_APP_TITLE_BY_ID[SYSTEM_APP_ID.DOCUMENTS],
          config.iconPath,
        );
      } else {
        openSystemApp(id);
      }
    },
    [openDocumentsDirectory, openSystemApp],
  );

  const openMediaViewer = useCallback(
    (request: Parameters<typeof media.open>[0]): void => {
      const id = media.open(request, desktop);
      focusWindow(id);
    },
    [desktop, focusWindow, media],
  );

  const openFilesystemEntry = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        openDocumentsDirectory(entry.id, entry.name, DESKTOP_ASSET_PATHS.FOLDER_ICON);
      } else if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
        void onOpenWidget(entry.widgetId);
      } else {
        const kind = mediaKindFromContentType(entry.contentType);
        if (kind) openMediaViewer({ entry, directoryId: entry.parentId, kind });
        else downloadFile(filesystem.downloadUrl(entry.id));
      }
    },
    [filesystem, onOpenWidget, openDocumentsDirectory, openMediaViewer],
  );

  return {
    addWidget,
    openSystemApp,
    openDocumentsDirectory,
    openSystemShortcut,
    openMediaViewer,
    openFilesystemEntry,
  } as const;
}
