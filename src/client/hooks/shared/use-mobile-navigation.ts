import { useCallback, useEffect, useRef, useState } from "react";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/mobile/activity";
import type {
  MobileActivity,
  MobileNavigationController,
} from "@client/types/app/mobile-navigation";

const HOME_ACTIVITY = { kind: MOBILE_ACTIVITY_KIND.HOME } as const;
const HISTORY_MARKER = "computerRoomMobileDepth";

export function useMobileNavigation(
  initialActivity: MobileActivity = HOME_ACTIVITY,
): MobileNavigationController {
  const [stack, setStack] = useState<readonly MobileActivity[]>([
    HOME_ACTIVITY,
    ...(initialActivity.kind === MOBILE_ACTIVITY_KIND.HOME
      ? []
      : [initialActivity]),
  ]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, [HISTORY_MARKER]: stackRef.current.length - 1 },
      "",
    );
    const onPopState = (event: PopStateEvent): void => {
      const depth = readHistoryDepth(event.state);
      if (depth === null) return;
      const nextLength = Math.max(
        1,
        Math.min(stackRef.current.length, depth + 1),
      );
      const next = stackRef.current.slice(0, nextLength);
      stackRef.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const push = useCallback((activity: MobileActivity): void => {
    const next = [...stackRef.current, activity];
    stackRef.current = next;
    window.history.pushState(
      { ...window.history.state, [HISTORY_MARKER]: next.length - 1 },
      "",
    );
    setStack(next);
  }, []);

  const back = useCallback((): void => {
    if (stackRef.current.length > 1) window.history.back();
  }, []);

  const home = useCallback((): void => {
    const next = [HOME_ACTIVITY];
    stackRef.current = next;
    setStack(next);
    window.history.replaceState(
      { ...window.history.state, [HISTORY_MARKER]: 0 },
      "",
    );
  }, []);

  const replace = useCallback((activity: MobileActivity): void => {
    const next = [...stackRef.current.slice(0, -1), activity];
    stackRef.current = next;
    window.history.replaceState(
      { ...window.history.state, [HISTORY_MARKER]: next.length - 1 },
      "",
    );
    setStack(next);
  }, []);

  return {
    current: stack[stack.length - 1] ?? HOME_ACTIVITY,
    canGoBack: stack.length > 1,
    push,
    back,
    home,
    replace,
  };
}

function readHistoryDepth(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const depth = (value as Record<string, unknown>)[HISTORY_MARKER];
  return typeof depth === "number" && Number.isSafeInteger(depth) && depth >= 0
    ? depth
    : null;
}
