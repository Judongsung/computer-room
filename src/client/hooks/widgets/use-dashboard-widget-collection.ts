import { useCallback, type RefObject } from "react";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-data";
import type { DashboardWidget, WidgetLayout } from "@/types/widgets/widget";
import type { DashboardWidgetCollectionController } from "@client/types/widgets/dashboard";

interface UseDashboardWidgetCollectionOptions {
  readonly widgetsRef: RefObject<readonly DashboardWidget[]>;
  readonly replaceWidgets: (widgets: readonly DashboardWidget[]) => void;
  readonly scheduleLayoutSave: (widgets: readonly WidgetLayout[]) => void;
  readonly forgetLayouts: (widgetIds: readonly string[]) => void;
}

export function useDashboardWidgetCollection({
  widgetsRef,
  replaceWidgets,
  scheduleLayoutSave,
  forgetLayouts,
}: UseDashboardWidgetCollectionOptions): DashboardWidgetCollectionController {
  const current = useCallback(
    (): readonly DashboardWidget[] => widgetsRef.current,
    [widgetsRef],
  );

  const replaceAndSave = useCallback(
    (
      update: (
        widgets: readonly DashboardWidget[],
      ) => readonly DashboardWidget[],
    ): void => {
      const widgets = cloneDashboardWidgets(update(widgetsRef.current));
      replaceWidgets(widgets);
      scheduleLayoutSave(widgets);
    },
    [replaceWidgets, scheduleLayoutSave, widgetsRef],
  );

  const replaceWidget = useCallback(
    (widget: DashboardWidget): void => {
      const widgets = cloneDashboardWidgets(
        widgetsRef.current.map((candidate) =>
          candidate.id === widget.id ? widget : candidate,
        ),
      );
      replaceWidgets(widgets);
    },
    [replaceWidgets, widgetsRef],
  );

  const removeWidgets = useCallback(
    (widgetIds: readonly string[]): void => {
      if (widgetIds.length === 0) return;
      const ids = new Set(widgetIds);
      forgetLayouts(widgetIds);
      replaceWidgets(
        widgetsRef.current.filter((widget) => !ids.has(widget.id)),
      );
    },
    [forgetLayouts, replaceWidgets, widgetsRef],
  );

  return { current, replaceAndSave, replaceWidget, removeWidgets };
}
