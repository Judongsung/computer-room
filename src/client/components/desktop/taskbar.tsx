import {
  DASHBOARD_COPY,
  LAYOUT_SAVE_COPY_BY_STATUS,
} from "../../constants/content";
import { DESKTOP_ASSET_PATHS } from "../../constants/desktop";
import { LAYOUT_SAVE_STATUS } from "../../constants/layout-save";
import { useKoreaClock } from "../../hooks/use-korea-clock";
import type { TaskbarProps } from "../../types/desktop";

export function Taskbar({
  windows,
  isStartMenuOpen,
  saveStatus,
  onToggleStartMenu,
  onActivateWindow,
}: TaskbarProps) {
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
