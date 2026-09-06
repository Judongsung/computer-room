import { useEffect } from "react";
import {
  CHECKLIST_RESET_BUFFER_MILLISECONDS,
  MAX_BROWSER_TIMER_DELAY_MILLISECONDS,
} from "@client/constants/widgets/checklist";

interface ChecklistRefreshOptions {
  readonly nextResetAt: string;
  readonly refresh: () => Promise<void>;
}

export function useChecklistRefresh({
  nextResetAt,
  refresh,
}: ChecklistRefreshOptions): void {
  useEffect(() => {
    const resetAt = Date.parse(nextResetAt);
    if (!Number.isFinite(resetAt)) {
      return undefined;
    }
    let timeout: ReturnType<typeof window.setTimeout>;
    const schedule = (): void => {
      const delay = Math.min(
        Math.max(
          resetAt - Date.now() + CHECKLIST_RESET_BUFFER_MILLISECONDS,
          CHECKLIST_RESET_BUFFER_MILLISECONDS,
        ),
        MAX_BROWSER_TIMER_DELAY_MILLISECONDS,
      );
      timeout = window.setTimeout(() => {
        if (Date.now() < resetAt) schedule();
        else void refresh();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, [nextResetAt, refresh]);

  useEffect(() => {
    if (!Number.isFinite(Date.parse(nextResetAt))) return;
    const refreshWhenVisible = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [nextResetAt, refresh]);
}
