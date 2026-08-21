import { useCallback, useRef, useState, type CSSProperties } from "react";
import { WIDGET_TYPE } from "../../../constants/widget";
import { DASHBOARD_COPY, SITE_COPY } from "../../constants/content";
import {
  DESKTOP_ASSET_PATHS,
  DESKTOP_LAYOUT,
} from "../../constants/desktop";
import { LAYOUT_SAVE_STATUS } from "../../constants/layout-save";
import { useDesktopDimensions } from "../../hooks/use-desktop-dimensions";
import type { DesktopShellProps } from "../../types/desktop";
import { DesktopWindow } from "./desktop-window";
import { DesktopNotification } from "./desktop-notification";
import { StartMenu } from "./start-menu";
import { Taskbar } from "./taskbar";

const DESKTOP_BACKGROUND_STYLE = {
  "--desktop-background-image": `url("${DESKTOP_ASSET_PATHS.BACKGROUND}")`,
  "--start-button-mask-image": `url("${DESKTOP_ASSET_PATHS.START_BUTTON_MASK}")`,
  "--start-menu-z-index": DESKTOP_LAYOUT.START_MENU_Z_INDEX,
  "--taskbar-z-index": DESKTOP_LAYOUT.TASKBAR_Z_INDEX,
  "--modal-z-index": DESKTOP_LAYOUT.MODAL_Z_INDEX,
} as CSSProperties;

export function DesktopShell({
  session,
  widgets,
  activeWidgetId,
  gateway,
  layoutSaveStatus,
  layoutSaveError,
  message,
  onAddWidget,
  onFocusWindow,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onActivateTaskbarWindow,
  onCommitWindowBounds,
  onWidgetChange,
  onRetrySave,
  onDismissMessage,
}: DesktopShellProps) {
  const workAreaRef = useRef<HTMLElement>(null);
  const desktop = useDesktopDimensions(workAreaRef);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const closeStartMenu = useCallback(() => setIsStartMenuOpen(false), []);
  const addWidget = useCallback(
    (type: (typeof WIDGET_TYPE)[keyof typeof WIDGET_TYPE]): void => {
      onAddWidget(type, desktop);
      closeStartMenu();
    },
    [closeStartMenu, desktop, onAddWidget],
  );

  return (
    <div className="desktop-shell" style={DESKTOP_BACKGROUND_STYLE}>
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        aria-label={DASHBOARD_COPY.DESKTOP}
        onMouseDown={closeStartMenu}
      >
        {widgets.length === 0 ? (
          <p className="desktop-empty-hint">{DASHBOARD_COPY.EMPTY_DESKTOP}</p>
        ) : null}
        {widgets.map((widget) => (
          <DesktopWindow
            key={widget.id}
            widget={widget}
            desktop={desktop}
            isActive={widget.id === activeWidgetId}
            gateway={gateway}
            onFocus={() => onFocusWindow(widget.id)}
            onMinimize={() => onMinimizeWindow(widget.id)}
            onToggleMaximize={() => onToggleMaximizeWindow(widget.id)}
            onCommitBounds={(bounds) =>
              onCommitWindowBounds(widget.id, bounds)
            }
            onWidgetChange={onWidgetChange}
          />
        ))}
      </main>

      {layoutSaveStatus === LAYOUT_SAVE_STATUS.ERROR && layoutSaveError ? (
        <DesktopNotification
          title={DASHBOARD_COPY.SAVE_FAILED}
          message={layoutSaveError}
          actionLabel={DASHBOARD_COPY.RETRY}
          onAction={onRetrySave}
        />
      ) : message ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={message.text}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={onDismissMessage}
        />
      ) : null}
      <StartMenu
        isOpen={isStartMenuOpen}
        email={session.email}
        logoutUrl={session.logoutUrl}
        onClose={closeStartMenu}
        onAddMemo={() => addWidget(WIDGET_TYPE.MEMO)}
        onAddChecklist={() => addWidget(WIDGET_TYPE.DAILY_CHECKLIST)}
      />
      <Taskbar
        widgets={widgets}
        activeWidgetId={activeWidgetId}
        isStartMenuOpen={isStartMenuOpen}
        saveStatus={layoutSaveStatus}
        onToggleStartMenu={() =>
          setIsStartMenuOpen((current) => !current)
        }
        onActivateWindow={onActivateTaskbarWindow}
      />
    </div>
  );
}
