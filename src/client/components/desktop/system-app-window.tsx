import { SYSTEM_APP_CONFIG } from "@client/constants/desktop/system-app";
import type { SystemAppWindowProps } from "@client/types/desktop/system-app";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";

export function SystemAppWindow({
  appId,
  ...props
}: SystemAppWindowProps) {
  const config = SYSTEM_APP_CONFIG[appId];
  return (
    <DesktopAppWindow
      {...props}
      title={config.title}
      iconPath={config.iconPath}
      minWidth={config.minWidth}
      minHeight={config.minHeight}
    />
  );
}
