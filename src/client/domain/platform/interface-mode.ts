import {
  CLIENT_INTERFACE_MODE,
  MOBILE_INTERFACE_MEDIA_QUERY,
} from "@client/constants/shared/interface-mode";
import type { ClientInterfaceMode } from "@client/types/app/app";

export function detectClientInterfaceMode(
  matchMedia: typeof window.matchMedia | undefined =
    typeof window === "undefined" ? undefined : window.matchMedia?.bind(window),
): ClientInterfaceMode {
  if (!matchMedia) return CLIENT_INTERFACE_MODE.DESKTOP;
  return matchMedia(MOBILE_INTERFACE_MEDIA_QUERY).matches
    ? CLIENT_INTERFACE_MODE.MOBILE
    : CLIENT_INTERFACE_MODE.DESKTOP;
}
