import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import {
  XP_WIDGET_TOOLBAR_ACTION,
  XP_WINDOW_CONTROL_ACTION,
} from "@client/constants/shared/xp";
import type { WidgetCardProps } from "@client/types/desktop/desktop";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import { XpWindowControlButton } from "@client/components/shared/xp-window-control-button";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";

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
      toolbar={
        windowControls.canSaveFile || toolbarActions ? (
          <>
            {windowControls.canSaveFile ? (
              <XpWidgetToolbarButton
                action={XP_WIDGET_TOOLBAR_ACTION.SAVE_FILE}
                label={DASHBOARD_COPY.SAVE_AS_FILE}
                onClick={windowControls.onSaveFile}
              />
            ) : null}
            {toolbarActions}
          </>
        ) : undefined
      }
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
            label={DASHBOARD_COPY.CLOSE}
            onClick={windowControls.onClose}
          />
        </>
      }
    >
      {children}
    </XpWindowFrame>
  );
}
