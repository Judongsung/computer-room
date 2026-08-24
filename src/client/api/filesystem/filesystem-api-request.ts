import { API_QUERY_PARAMETERS } from "@/constants/platform/api";
import { HTTP_HEADERS, HTTP_MEDIA_TYPE } from "@/constants/platform/http";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
    body: JSON.stringify(body),
  };
}

export function placementBody(placement?: DesktopPlacement): Record<string, number> {
  return placement ? {
    [API_QUERY_PARAMETERS.DESKTOP_TARGET_INDEX]: placement.targetIndex,
    [API_QUERY_PARAMETERS.DESKTOP_CAPACITY]: placement.capacity,
  } : {};
}

export function appendPlacementQuery(query: URLSearchParams, placement?: DesktopPlacement): void {
  if (!placement) return;
  query.set(API_QUERY_PARAMETERS.DESKTOP_TARGET_INDEX, String(placement.targetIndex));
  query.set(API_QUERY_PARAMETERS.DESKTOP_CAPACITY, String(placement.capacity));
}
