import { lazy } from "react";
import { DESKTOP_ASSET_PATHS, DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import { NOTEPAD_CLASS_NAME, NOTEPAD_WINDOW } from "@client/constants/filesystem/text/notepad";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";
import type { NotepadWindowLayerProps } from "@client/types/filesystem/text/notepad";

const TextDocument = lazy(() => import("@client/components/shared/text/text-document").then((module) => ({ default: module.TextDocument })));

export function NotepadWindowLayer({ controller, gateway, desktop, manager }: NotepadWindowLayerProps) {
  return controller.windows.map((window) => (
    <DesktopAppWindow
      key={window.id}
      title={NOTEPAD_COPY.WINDOW_TITLE(window.file.name)}
      iconPath={DESKTOP_ASSET_PATHS.MEMO_ICON}
      window={window}
      desktop={desktop}
      isActive={manager.activeWindowId === window.id}
      zIndex={DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX + (manager.zOrders[window.id] ?? 0)}
      minWidth={NOTEPAD_WINDOW.MIN_WIDTH}
      minHeight={NOTEPAD_WINDOW.MIN_HEIGHT}
      bodyClassName={NOTEPAD_CLASS_NAME.DESKTOP_BODY}
      onFocus={() => manager.focus(window.id)}
      onMinimize={() => manager.minimize(window.id)}
      onToggleMaximize={() => manager.toggleMaximize(window.id)}
      onClose={() => { controller.close(window.id); manager.clearActive(window.id); }}
      onCommitBounds={(bounds) => controller.commitBounds(window.id, bounds)}
    >
      <LazyFeatureBoundary title={NOTEPAD_COPY.TITLE} inline>
        <TextDocument file={window.file} gateway={gateway} />
      </LazyFeatureBoundary>
    </DesktopAppWindow>
  ));
}
