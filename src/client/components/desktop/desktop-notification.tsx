import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import type { DesktopNotificationProps } from "@client/types/desktop/desktop";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";

export function DesktopNotification({
  title,
  message,
  actionLabel,
  onAction,
}: DesktopNotificationProps) {
  return (
    <XpWindowFrame
      className="desktop-notification"
      title={title}
      iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
      bodyClassName="desktop-notification__body"
      role="alert"
    >
      <p>{message}</p>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </XpWindowFrame>
  );
}
