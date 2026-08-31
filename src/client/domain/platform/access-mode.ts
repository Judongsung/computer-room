import {
  ACCESS_MODE_OWNER_VALUE,
  ACCESS_MODE_QUERY_PARAMETER,
} from "@/constants/platform/auth";
import { OWNER_ACCESS_STORAGE_KEY } from "@client/constants/platform/access";

export function consumeOwnerAccessQuery(location: Location, history: History): boolean {
  const url = new URL(location.href);
  const ownerRequested =
    url.searchParams.get(ACCESS_MODE_QUERY_PARAMETER) === ACCESS_MODE_OWNER_VALUE;
  if (!url.searchParams.has(ACCESS_MODE_QUERY_PARAMETER)) return false;

  url.searchParams.delete(ACCESS_MODE_QUERY_PARAMETER);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  if (ownerRequested) rememberOwnerAccess();
  return ownerRequested;
}

export function hasOwnerAccessHint(): boolean {
  try {
    return localStorage.getItem(OWNER_ACCESS_STORAGE_KEY) === ACCESS_MODE_OWNER_VALUE;
  } catch {
    return false;
  }
}

export function rememberOwnerAccess(): void {
  try {
    localStorage.setItem(OWNER_ACCESS_STORAGE_KEY, ACCESS_MODE_OWNER_VALUE);
  } catch {
    // Storage can be unavailable in privacy modes; the authenticated page still works.
  }
}

export function clearOwnerAccessHint(): void {
  try {
    localStorage.removeItem(OWNER_ACCESS_STORAGE_KEY);
  } catch {
    // A failed cleanup only causes the next bootstrap to perform one owner probe.
  }
}
