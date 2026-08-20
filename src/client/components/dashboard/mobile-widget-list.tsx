import type { CSSProperties } from "react";
import { sortWidgetLayouts } from "../../../domain/widget-layout";
import type { WidgetLayout } from "../../../types/widget";
import { BlankWidget } from "./blank-widget";

interface MobileWidgetListProps {
  readonly widgets: readonly WidgetLayout[];
}

export function MobileWidgetList({ widgets }: MobileWidgetListProps) {
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
          <BlankWidget isEditing={false} onDelete={() => undefined} />
        </li>
      ))}
    </ol>
  );
}
