import { useEffect, useState } from "react";
import {
  CLIENT_INTERFACE_MODE,
  MOBILE_INTERFACE_MEDIA_QUERY,
} from "@client/constants/shared/interface-mode";
import { detectClientInterfaceMode } from "@client/domain/platform/interface-mode";
import type { ClientInterfaceMode } from "@client/types/app/app";

export function useInterfaceMode(
  forcedMode?: ClientInterfaceMode,
): ClientInterfaceMode {
  const [detectedMode, setDetectedMode] = useState(detectClientInterfaceMode);
  const mode = forcedMode ?? detectedMode;

  useEffect(() => {
    document.documentElement.dataset.interfaceMode = mode;
  }, [mode]);

  useEffect(() => {
    if (forcedMode || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(MOBILE_INTERFACE_MEDIA_QUERY);
    const update = (): void => {
      setDetectedMode(
        query.matches
          ? CLIENT_INTERFACE_MODE.MOBILE
          : CLIENT_INTERFACE_MODE.DESKTOP,
      );
    };
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [forcedMode]);

  return mode;
}
