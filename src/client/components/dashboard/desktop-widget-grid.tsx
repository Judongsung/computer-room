import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
  type Compactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import {
  BLANK_WIDGET_SIZE,
  GRID_COLUMN_COUNT,
} from "../../../constants/widget";
import { sortWidgetLayouts } from "../../../domain/widget-layout";
import type { WidgetLayout } from "../../../types/widget";
import { DASHBOARD_LAYOUT } from "../../constants/dashboard";
import { BlankWidget } from "./blank-widget";

const FIXED_GRID_COMPACTOR: Compactor = {
  ...noCompactor,
  preventCollision: true,
};

interface DesktopWidgetGridProps {
  readonly widgets: readonly WidgetLayout[];
  readonly isEditing: boolean;
  readonly onLayoutChange: (widgets: readonly WidgetLayout[]) => void;
  readonly onDelete: (id: string) => void;
}

export function DesktopWidgetGrid({
  widgets,
  isEditing,
  onLayoutChange,
  onDelete,
}: DesktopWidgetGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const layout = toGridLayout(widgets, isEditing);

  return (
    <div
      ref={containerRef}
      className={isEditing ? "widget-grid widget-grid--editing" : "widget-grid"}
    >
      {mounted ? (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: GRID_COLUMN_COUNT,
            rowHeight: DASHBOARD_LAYOUT.ROW_HEIGHT_PX,
            margin: [DASHBOARD_LAYOUT.GAP_PX, DASHBOARD_LAYOUT.GAP_PX],
            containerPadding: [0, 0],
            maxRows: Number.POSITIVE_INFINITY,
          }}
          dragConfig={{
            enabled: isEditing,
            bounded: true,
            handle: ".widget-card__drag-handle",
            cancel: ".widget-card__action",
          }}
          resizeConfig={{ enabled: isEditing, handles: ["se"] }}
          compactor={FIXED_GRID_COMPACTOR}
          onLayoutChange={(nextLayout) => {
            if (isEditing) {
              onLayoutChange(fromGridLayout(nextLayout, widgets));
            }
          }}
        >
          {widgets.map((widget) => (
            <div key={widget.id} className="widget-grid__item">
              <BlankWidget
                isEditing={isEditing}
                onDelete={() => onDelete(widget.id)}
              />
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  );
}

export function toGridLayout(
  widgets: readonly WidgetLayout[],
  isEditing: boolean,
): LayoutItem[] {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.position.column,
    y: widget.position.row,
    w: widget.size.columns,
    h: widget.size.rows,
    minW: BLANK_WIDGET_SIZE.MIN_COLUMNS,
    minH: BLANK_WIDGET_SIZE.MIN_ROWS,
    maxW: BLANK_WIDGET_SIZE.MAX_COLUMNS,
    maxH: BLANK_WIDGET_SIZE.MAX_ROWS,
    isDraggable: isEditing,
    isResizable: isEditing,
    isBounded: true,
  }));
}

export function fromGridLayout(
  layout: Layout,
  widgets: readonly WidgetLayout[],
): WidgetLayout[] {
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
  const nextWidgets: WidgetLayout[] = [];

  for (const item of layout) {
    const widget = widgetsById.get(item.i);
    if (!widget) {
      continue;
    }
    nextWidgets.push({
      id: widget.id,
      type: widget.type,
      position: { column: item.x, row: item.y },
      size: { columns: item.w, rows: item.h },
    });
  }

  return sortWidgetLayouts(nextWidgets);
}
