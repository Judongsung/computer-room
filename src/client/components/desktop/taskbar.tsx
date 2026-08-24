import {
  DASHBOARD_COPY,
  LAYOUT_SAVE_COPY_BY_STATUS,
} from "@client/constants/widgets/content";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { LAYOUT_SAVE_STATUS } from "@client/constants/desktop/layout-save";
import { useKoreaClock } from "@client/hooks/shared/use-korea-clock";
import type { TaskbarProps } from "@client/types/desktop/desktop";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";

export function Taskbar({
  windows,
  isStartMenuOpen,
  saveStatus,
  onToggleStartMenu,
  onActivateWindow,
  onRestoreWindow,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: TaskbarProps) {
  const contextMenu = useXpContextMenu();
  const clock = useKoreaClock();

  return (
    <footer className="taskbar" aria-label={DASHBOARD_COPY.TASKBAR}>
      <button
        type="button"
        className={
          isStartMenuOpen
            ? "taskbar__start taskbar__start--active"
            : "taskbar__start"
        }
        data-start-button
        aria-expanded={isStartMenuOpen}
        onClick={onToggleStartMenu}
        onContextMenu={(event) =>
          contextMenu.openFromEvent(event, [
            contextMenuCommand(
              XP_CONTEXT_MENU_COMMAND_ID.OPEN,
              DASHBOARD_COPY.START_MENU,
              onToggleStartMenu,
            ),
          ])
        }
      >
        <img src={DESKTOP_ASSET_PATHS.START_LOGO} alt="" />
        <span>{DASHBOARD_COPY.START}</span>
      </button>
      <div className="taskbar__windows">
        {windows.map((window) => {
          return (
            <button
              key={window.id}
              type="button"
              className={[
                "taskbar__window",
                window.isActive ? "taskbar__window--active" : "",
                window.isMinimized ? "taskbar__window--minimized" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={window.isActive}
              onClick={() => onActivateWindow(window.id)}
              onContextMenu={(event) =>
                contextMenu.openFromEvent(event, [
                  contextMenuCommand(
                    XP_CONTEXT_MENU_COMMAND_ID.RESTORE,
                    DASHBOARD_COPY.RESTORE,
                    () => onRestoreWindow(window.id),
                    !window.isMinimized && !window.isMaximized,
                  ),
                  contextMenuCommand(
                    XP_CONTEXT_MENU_COMMAND_ID.MINIMIZE,
                    DASHBOARD_COPY.MINIMIZE,
                    () => onMinimizeWindow(window.id),
                    window.isMinimized,
                  ),
                  contextMenuCommand(
                    XP_CONTEXT_MENU_COMMAND_ID.MAXIMIZE,
                    DASHBOARD_COPY.MAXIMIZE,
                    () => onToggleMaximizeWindow(window.id),
                    window.isMaximized,
                  ),
                  contextMenuCommand(
                    XP_CONTEXT_MENU_COMMAND_ID.CLOSE,
                    DASHBOARD_COPY.CLOSE,
                    () => onCloseWindow(window.id),
                  ),
                ])
              }
            >
              <img src={window.iconPath} alt="" />
              <span>{window.title}</span>
            </button>
          );
        })}
      </div>
      <div className="taskbar__tray">
        <span
          className={`taskbar__save taskbar__save--${saveStatus}`}
          role={saveStatus === LAYOUT_SAVE_STATUS.ERROR ? "alert" : "status"}
        >
          {LAYOUT_SAVE_COPY_BY_STATUS[saveStatus]}
        </span>
        <time title={clock.dateTime}>{clock.time}</time>
      </div>
    </footer>
  );
}
