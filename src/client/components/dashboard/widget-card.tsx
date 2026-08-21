import { DASHBOARD_COPY } from "../../constants/content";
import { XP_WINDOW_CONTROL_ACTION } from "../../constants/xp";
import type { WidgetCardProps } from "../../types/desktop";
import { XpWindowFrame } from "../desktop/xp-window-frame";
import { XpWindowControlButton } from "../ui/xp-window-control-button";

export function WidgetCard({
  title,
  iconPath,
  windowControls,
  toolbarActions,
  children,
}: WidgetCardProps) {
  const maximizeAction = windowControls.isMaximized
    ? XP_WINDOW_CONTROL_ACTION.RESTORE
    : XP_WINDOW_CONTROL_ACTION.MAXIMIZE;
  const maximizeLabel = windowControls.isMaximized
    ? DASHBOARD_COPY.RESTORE
    : DASHBOARD_COPY.MAXIMIZE;

  return (
    <XpWindowFrame
      className="widget-card"
      title={title}
      iconPath={iconPath}
      isActive={windowControls.isActive}
      titleBarClassName="widget-card__header widget-card__drag-handle"
      bodyClassName="widget-card__body"
      toolbar={toolbarActions}
      onMouseDown={windowControls.onFocus}
      onTitleBarDoubleClick={windowControls.onToggleMaximize}
      controls={
        <>
          <XpWindowControlButton
            action={XP_WINDOW_CONTROL_ACTION.MINIMIZE}
            label={DASHBOARD_COPY.MINIMIZE}
            onClick={windowControls.onMinimize}
          />
          <XpWindowControlButton
            action={maximizeAction}
            label={maximizeLabel}
            onClick={windowControls.onToggleMaximize}
          />
          <XpWindowControlButton
            action={XP_WINDOW_CONTROL_ACTION.CLOSE}
            label={DASHBOARD_COPY.CLOSE_DISABLED}
            disabled
          />
        </>
      }
    >
      {children}
    </XpWindowFrame>
  );
}
