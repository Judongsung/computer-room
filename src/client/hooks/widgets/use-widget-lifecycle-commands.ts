import { useCallback } from "react";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_BEHAVIOR,
  WIDGET_WINDOW_POLICY,
} from "@/constants/widgets/widget";
import type { SaveWidgetFileInput } from "@/types/filesystem/filesystem";
import type { DashboardWidget, WidgetType } from "@/types/widgets/widget";
import { bringWidgetToFront, cascadeWindowPosition } from "@client/domain/desktop/window-layout";
import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import type { DesktopDimensions } from "@client/types/desktop/window";
import type {
  DashboardWidgetCollectionController,
  WidgetOpenResult,
  WidgetLifecycleCommands,
} from "@client/types/widgets/dashboard";
import type { WidgetLifecycleGateway } from "@client/types/widgets/ports/lifecycle";

interface UseWidgetLifecycleCommandsOptions {
  readonly gateway: WidgetLifecycleGateway;
  readonly collection: DashboardWidgetCollectionController;
  readonly reportError: (error: unknown, fallback: string) => void;
  readonly reportMessage: (message: string) => void;
}

export function useWidgetLifecycleCommands({
  gateway,
  collection,
  reportError,
  reportMessage,
}: UseWidgetLifecycleCommandsOptions): WidgetLifecycleCommands {
  const {
    current,
    replaceAndSave,
    replaceWidget,
    removeWidgets,
  } = collection;

  const addWidget = useCallback(
    async (
      type: WidgetType,
      desktop: DesktopDimensions,
    ): Promise<WidgetOpenResult> => {
      const widgets = current();
      const existingSingleton = WIDGET_BEHAVIOR[type].singleton
        ? widgets.find((widget) => widget.type === type)
        : undefined;
      if (existingSingleton) {
        replaceAndSave((items) =>
          bringWidgetToFront(items, existingSingleton.id),
        );
        return existingSingleton.id;
      }
      if (widgets.length >= MAX_OPEN_WIDGET_COUNT) {
        reportMessage(UI_MESSAGES.MAX_WIDGETS);
        return null;
      }

      const policy = WIDGET_WINDOW_POLICY[type];
      const size = {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      };
      try {
        const widget = await gateway.createWidget({
          type,
          position: cascadeWindowPosition(widgets.length, size, desktop),
          size,
        });
        replaceAndSave((items) => {
          const exists = items.some((candidate) => candidate.id === widget.id);
          const merged = exists
            ? items.map((candidate) =>
                candidate.id === widget.id ? widget : candidate,
              )
            : [...items, widget];
          return bringWidgetToFront(merged, widget.id);
        });
        return widget.id;
      } catch (error) {
        reportError(error, UI_MESSAGES.SAVE_FAILED);
        return null;
      }
    },
    [current, gateway, replaceAndSave, reportError, reportMessage],
  );

  const saveWidgetFile = useCallback(
    async (widgetId: string, input: SaveWidgetFileInput): Promise<void> => {
      try {
        const { widget } = await gateway.saveWidgetFile(widgetId, input);
        replaceWidget(widget);
      } catch (error) {
        reportError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [gateway, replaceWidget, reportError],
  );

  const openWidget = useCallback(
    async (widgetId: string): Promise<WidgetOpenResult> => {
      const existing = current().find((widget) => widget.id === widgetId);
      if (existing) {
        replaceAndSave((widgets) => bringWidgetToFront(widgets, widgetId));
        return widgetId;
      }
      try {
        const widget = await gateway.openWidget(widgetId);
        replaceAndSave((widgets) => [
          ...widgets,
          {
            ...widget,
            stackOrder:
              Math.max(-1, ...widgets.map((item) => item.stackOrder)) + 1,
          },
        ]);
        return widget.id;
      } catch (error) {
        reportError(error, UI_MESSAGES.LOAD_FAILED);
        return null;
      }
    },
    [current, gateway, replaceAndSave, reportError],
  );

  const closeWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      try {
        await gateway.closeWidget(widgetId);
        removeWidgets([widgetId]);
      } catch (error) {
        reportError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [gateway, removeWidgets, reportError],
  );

  const discardWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      try {
        await gateway.discardWidget(widgetId);
        removeWidgets([widgetId]);
      } catch (error) {
        reportError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [gateway, removeWidgets, reportError],
  );

  const updateWidget = useCallback(
    (widget: DashboardWidget): void => replaceWidget(widget),
    [replaceWidget],
  );

  return {
    addWidget,
    saveWidgetFile,
    openWidget,
    closeWidget,
    discardWidget,
    removeWidgets,
    updateWidget,
  };
}
