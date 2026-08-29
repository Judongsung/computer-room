import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";

export function mergeSavedDashboardWidgetMetadata(
  currentWidgets: readonly DashboardWidget[],
  savedWidgets: readonly DashboardWidget[],
): DashboardWidget[] {
  const savedById = new Map(
    savedWidgets.map((widget) => [widget.id, widget] as const),
  );
  return currentWidgets.map((widget) => {
    const saved = savedById.get(widget.id);
    if (
      widget.type !== WIDGET_TYPE.DAILY_CHECKLIST ||
      saved?.type !== WIDGET_TYPE.DAILY_CHECKLIST
    ) {
      return widget;
    }
    return {
      ...widget,
      data: {
        ...widget.data,
        businessDate: saved.data.businessDate,
        nextResetAt: saved.data.nextResetAt,
      },
    };
  });
}
