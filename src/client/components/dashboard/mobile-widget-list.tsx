import type { CSSProperties } from "react";
import { sortWidgetLayouts } from "../../../domain/widget-layout";
import type { DashboardWidget } from "../../../types/widget";
import type { DashboardGateway } from "../../types/api";
import { WidgetRenderer } from "./widget-renderer";

interface MobileWidgetListProps {
  readonly widgets: readonly DashboardWidget[];
  readonly gateway: DashboardGateway;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

export function MobileWidgetList({
  widgets,
  gateway,
  onWidgetChange,
}: MobileWidgetListProps) {
  return (
    <ol className="mobile-widget-list">
      {sortWidgetLayouts(widgets).map((widget) => (
        <li
          key={widget.id}
          style={
            {
              "--mobile-widget-rows": widget.size.rows,
            } as CSSProperties
          }
        >
          <WidgetRenderer
            widget={widget}
            isEditingLayout={false}
            onDelete={() => undefined}
            gateway={gateway}
            onWidgetChange={onWidgetChange}
          />
        </li>
      ))}
    </ol>
  );
}
