import { useCallback, useRef, useState } from "react";
import { ACCESS_GUEST_LANDING_PATH } from "@/constants/platform/auth";
import { AccessApiClient } from "@client/api/platform/access-api-client";
import { clearOwnerAccessHint } from "@client/domain/platform/access-mode";
import type {
  AccessLogoutGateway,
  AccessLogoutNavigator,
} from "@client/types/platform/access";

interface AccessLogoutDependencies {
  readonly gateway?: AccessLogoutGateway;
  readonly navigator?: AccessLogoutNavigator;
}

const DEFAULT_GATEWAY = new AccessApiClient();
const BROWSER_NAVIGATOR: AccessLogoutNavigator = {
  replace: (path) => window.location.replace(path),
  assign: (path) => window.location.assign(path),
};

export function useAccessLogout(
  logoutUrl: string,
  dependencies: AccessLogoutDependencies = {},
) {
  const gateway = dependencies.gateway ?? DEFAULT_GATEWAY;
  const navigator = dependencies.navigator ?? BROWSER_NAVIGATOR;
  const runningRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async (): Promise<void> => {
    if (runningRef.current) return;

    runningRef.current = true;
    setIsLoggingOut(true);
    clearOwnerAccessHint();

    try {
      await gateway.logout(logoutUrl);
      runningRef.current = false;
      setIsLoggingOut(false);
      navigator.replace(ACCESS_GUEST_LANDING_PATH);
    } catch {
      runningRef.current = false;
      setIsLoggingOut(false);
      navigator.assign(logoutUrl);
    }
  }, [gateway, logoutUrl, navigator]);

  return { isLoggingOut, logout } as const;
}
