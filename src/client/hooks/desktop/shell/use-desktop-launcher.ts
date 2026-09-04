import { useCallback, useMemo } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import type { FilesystemEntry, FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { createFileOpener } from "@client/domain/filesystem/text/file-opening";
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
import type { WidgetOpenResult } from "@client/types/widgets/dashboard";

interface DesktopLauncherOptions {
  readonly desktop: DesktopDimensions;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly onOpenText: (file: FilesystemFileEntry) => void;
  readonly onRequestDownload: (file: FilesystemFileEntry) => void;
  readonly focusWindow: (id: string, persist?: () => void) => void;
  readonly closeStartMenu: () => void;
  readonly onAddWidget: (
    type: WidgetType,
    desktop: DesktopDimensions,
  ) => Promise<WidgetOpenResult>;
  readonly onOpenWidget: (widgetId: string) => Promise<WidgetOpenResult>;
}

export function useDesktopLauncher({
  desktop,
  system,
  explorer,
  media,
  onOpenText,
  onRequestDownload,
  focusWindow,
  closeStartMenu,
  onAddWidget,
  onOpenWidget,
}: DesktopLauncherOptions) {
  const focusOpenedWidget = useCallback(
    async (operation: Promise<WidgetOpenResult>): Promise<void> => {
      const widgetId = await operation;
      if (widgetId) focusWindow(widgetId);
    },
    [focusWindow],
  );

  const launchApplication = useCallback(
    (type: WidgetType): void => {
      closeStartMenu();
      void focusOpenedWidget(onAddWidget(type, desktop));
    },
    [closeStartMenu, desktop, focusOpenedWidget, onAddWidget],
  );

  const openWidget = useCallback(
    (widgetId: string): void => {
      void focusOpenedWidget(onOpenWidget(widgetId));
    },
    [focusOpenedWidget, onOpenWidget],
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

  const openFile = useMemo(() => createFileOpener({
    media: openMediaViewer, text: onOpenText, download: onRequestDownload,
  }), [openMediaViewer, onOpenText, onRequestDownload]);

  const openFilesystemEntry = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        openDocumentsDirectory(entry.id, entry.name, DESKTOP_ASSET_PATHS.FOLDER_ICON);
      } else if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
        openWidget(entry.widgetId);
      } else {
        openFile(entry);
      }
    },
    [openFile, openDocumentsDirectory, openWidget],
  );

  return {
    launchApplication,
    openSystemApp,
    openDocumentsDirectory,
    openSystemShortcut,
    openMediaViewer,
    openWidget,
    openFilesystemEntry,
  } as const;
}
