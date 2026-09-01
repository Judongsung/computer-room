import { useCallback, type RefObject } from "react";
import {
  cloneDashboardWidget,
  cloneDashboardWidgets,
} from "@/domain/widgets/widget-data";
import { normalizeWidgetStackOrders } from "@/domain/widgets/widget-layout";
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
      const widgets = cloneDashboardWidgets(
        normalizeWidgetStackOrders(update(widgetsRef.current)),
      );
      replaceWidgets(widgets);
      scheduleLayoutSave(widgets);
    },
    [replaceWidgets, scheduleLayoutSave, widgetsRef],
  );

  const replaceWidget = useCallback(
    (widget: DashboardWidget): void => {
      const widgets = cloneDashboardWidgets(
        normalizeWidgetStackOrders(
          widgetsRef.current.map((candidate) =>
            candidate.id === widget.id
              ? preserveCurrentWidgetLayout(candidate, widget)
              : candidate,
          ),
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
        normalizeWidgetStackOrders(
          widgetsRef.current.filter((widget) => !ids.has(widget.id)),
        ),
      );
    },
    [forgetLayouts, replaceWidgets, widgetsRef],
  );

  return { current, replaceAndSave, replaceWidget, removeWidgets };
}

function preserveCurrentWidgetLayout(
  current: DashboardWidget,
  incoming: DashboardWidget,
): DashboardWidget {
  const cloned = cloneDashboardWidget(incoming);
  return {
    ...cloned,
    position: { ...current.position },
    size: { ...current.size },
    windowState: current.windowState,
    restoreState: current.restoreState,
    stackOrder: current.stackOrder,
  } as DashboardWidget;
}
