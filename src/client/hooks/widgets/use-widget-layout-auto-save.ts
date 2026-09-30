import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  cloneWidgetLayouts,
  normalizeWidgetStackOrders,
} from "@/domain/widgets/widget-layout";
import type { WidgetLayout } from "@/types/widgets/widget";
import {
  LAYOUT_SAVE_DEBOUNCE_MILLISECONDS,
  LAYOUT_SAVE_STATUS,
} from "@client/constants/desktop/layout-save";
import type { WidgetLayoutGateway } from "@client/types/widgets/ports/layout";
import { messageFromError } from "@client/errors/error-message";
import type {
  LayoutSaveStatus,
  WidgetLayoutAutoSaveController,
  WidgetLayoutAutoSaveOptions,
} from "@client/types/widgets/dashboard";

interface SaveTimer {
  id: number;
}

export function useWidgetLayoutAutoSave(
  api: WidgetLayoutGateway,
  options: WidgetLayoutAutoSaveOptions,
): WidgetLayoutAutoSaveController {
  const session = useMemo(() => ({
    api,
    active: false,
    snapshot: null as WidgetLayout[] | null,
    saving: null as object | null,
    timer: null as SaveTimer | null,
  }), [api]);
  const [state, setState] = useState({
    session,
    status: LAYOUT_SAVE_STATUS.IDLE as LayoutSaveStatus,
    error: null as string | null,
  });
  const currentOptions = useRef(options);
  useLayoutEffect(() => {
    currentOptions.current = options;
  }, [options]);

  const publish = useCallback((
    status: LayoutSaveStatus,
    error: string | null = null,
  ): void => {
    if (session.active) setState({ session, status, error });
  }, [session]);
  const clearTimer = useCallback((): void => {
    if (session.timer) window.clearTimeout(session.timer.id);
    session.timer = null;
  }, [session]);

  const flush = useCallback(async (): Promise<void> => {
    if (!session.active || session.saving || session.snapshot === null) return;
    clearTimer();
    const snapshot = session.snapshot;
    const token = {};
    session.snapshot = null;
    session.saving = token;
    publish(LAYOUT_SAVE_STATUS.SAVING);
    const current = () => session.active && session.saving === token;
    try {
      const savedWidgets = await session.api.replaceWidgets(snapshot);
      if (!current()) return;
      currentOptions.current.onSaved(savedWidgets);
      if (!current()) return;
      session.saving = null;
      if (session.snapshot === null) {
        publish(LAYOUT_SAVE_STATUS.SAVED);
      } else {
        publish(LAYOUT_SAVE_STATUS.PENDING);
        void flush();
      }
    } catch (saveError) {
      if (!current()) return;
      clearTimer();
      session.saving = null;
      session.snapshot ??= snapshot;
      publish(
        LAYOUT_SAVE_STATUS.ERROR,
        messageFromError(saveError, currentOptions.current.fallbackErrorMessage),
      );
    }
  }, [clearTimer, publish, session]);

  const schedule = useCallback((widgets: readonly WidgetLayout[]): void => {
    if (!session.active) return;
    session.snapshot = cloneWidgetLayouts(
      normalizeWidgetStackOrders(widgets),
    );
    publish(LAYOUT_SAVE_STATUS.PENDING);
    clearTimer();
    const timer: SaveTimer = { id: 0 };
    session.timer = timer;
    timer.id = window.setTimeout(() => {
      if (!session.active || session.timer !== timer) return;
      session.timer = null;
      void flush();
    }, LAYOUT_SAVE_DEBOUNCE_MILLISECONDS);
  }, [clearTimer, flush, publish, session]);

  const retry = useCallback((): void => {
    if (!session.active || session.snapshot === null) return;
    clearTimer();
    void flush();
  }, [clearTimer, flush, session]);
  const forget = useCallback((widgetIds: readonly string[]): void => {
    if (!session.active || session.snapshot === null) return;
    const ids = new Set(widgetIds);
    session.snapshot = normalizeWidgetStackOrders(
      session.snapshot.filter((widget) => !ids.has(widget.id)),
    );
  }, [session]);

  useLayoutEffect(() => {
    session.active = true;
    publish(LAYOUT_SAVE_STATUS.IDLE);
    return () => {
      session.active = false;
      clearTimer();
      session.snapshot = null;
      session.saving = null;
    };
  }, [clearTimer, publish, session]);

  const visible = state.session === session
    ? state
    : { status: LAYOUT_SAVE_STATUS.IDLE, error: null };
  return {
    status: visible.status,
    error: visible.error,
    hasUnsavedChanges:
      visible.status === LAYOUT_SAVE_STATUS.PENDING ||
      visible.status === LAYOUT_SAVE_STATUS.SAVING ||
      visible.status === LAYOUT_SAVE_STATUS.ERROR,
    schedule,
    forget,
    retry,
  };
}
