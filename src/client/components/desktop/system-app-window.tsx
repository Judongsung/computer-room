import { SYSTEM_APP_CONFIG } from "../../constants/system-app";
import type { SystemAppWindowProps } from "../../types/system-app";
import { DesktopAppWindow } from "./desktop-app-window";

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
