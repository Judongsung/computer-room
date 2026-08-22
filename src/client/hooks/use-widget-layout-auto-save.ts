import { useCallback, useEffect, useRef, useState } from "react";
import { cloneWidgetLayouts } from "../../domain/widget-layout";
import type { WidgetLayout } from "../../types/widget";
import {
  LAYOUT_SAVE_DEBOUNCE_MILLISECONDS,
  LAYOUT_SAVE_STATUS,
} from "../constants/layout-save";
import type { DashboardGateway } from "../types/api";
import type {
  LayoutSaveStatus,
  WidgetLayoutAutoSaveController,
  WidgetLayoutAutoSaveOptions,
} from "../types/dashboard";

export function useWidgetLayoutAutoSave(
  api: DashboardGateway,
  options: WidgetLayoutAutoSaveOptions,
): WidgetLayoutAutoSaveController {
  const [status, setStatus] = useState<LayoutSaveStatus>(
    LAYOUT_SAVE_STATUS.IDLE,
  );
  const [error, setError] = useState<string | null>(null);
  const latestSnapshot = useRef<WidgetLayout[] | null>(null);
  const timer = useRef<number | null>(null);
  const isSaving = useRef(false);
  const isMounted = useRef(true);

  const flush = useCallback(async (): Promise<void> => {
    if (isSaving.current || latestSnapshot.current === null) {
      return;
    }

    const snapshot = latestSnapshot.current;
    latestSnapshot.current = null;
    isSaving.current = true;
    setStatus(LAYOUT_SAVE_STATUS.SAVING);
    setError(null);

    try {
      const savedWidgets = await api.replaceWidgets(snapshot);
      if (!isMounted.current) {
        return;
      }
      options.onSaved(savedWidgets);
      isSaving.current = false;
      if (latestSnapshot.current === null) {
        setStatus(LAYOUT_SAVE_STATUS.SAVED);
      } else {
        setStatus(LAYOUT_SAVE_STATUS.PENDING);
        void flush();
      }
    } catch (saveError) {
      if (!isMounted.current) {
        return;
      }
      isSaving.current = false;
      latestSnapshot.current ??= snapshot;
      setStatus(LAYOUT_SAVE_STATUS.ERROR);
      setError(errorMessage(saveError, options.fallbackErrorMessage));
    }
  }, [api, options]);

  const schedule = useCallback(
    (widgets: readonly WidgetLayout[]): void => {
      latestSnapshot.current = cloneWidgetLayouts(widgets);
      setStatus(LAYOUT_SAVE_STATUS.PENDING);
      setError(null);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void flush();
      }, LAYOUT_SAVE_DEBOUNCE_MILLISECONDS);
    },
    [flush],
  );

  const retry = useCallback((): void => {
    if (latestSnapshot.current === null) {
      return;
    }
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    void flush();
  }, [flush]);

  const forget = useCallback((widgetIds: readonly string[]): void => {
    if (latestSnapshot.current === null) return;
    const ids = new Set(widgetIds);
    latestSnapshot.current = latestSnapshot.current.filter(
      (widget) => !ids.has(widget.id),
    );
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  return {
    status,
    error,
    hasUnsavedChanges:
      status === LAYOUT_SAVE_STATUS.PENDING ||
      status === LAYOUT_SAVE_STATUS.SAVING ||
      status === LAYOUT_SAVE_STATUS.ERROR,
    schedule,
    forget,
    retry,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
