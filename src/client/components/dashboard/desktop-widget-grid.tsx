import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
  type Compactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import {
  GRID_COLUMN_COUNT,
  WIDGET_SIZE_BY_TYPE,
} from "../../../constants/widget";
import { sortWidgetLayouts } from "../../../domain/widget-layout";
import type { DashboardWidget, WidgetLayout } from "../../../types/widget";
import { DASHBOARD_LAYOUT } from "../../constants/dashboard";
import type { DashboardGateway } from "../../types/api";
import { WidgetRenderer } from "./widget-renderer";

const FIXED_GRID_COMPACTOR: Compactor = {
  ...noCompactor,
  preventCollision: true,
};

interface DesktopWidgetGridProps {
  readonly widgets: readonly DashboardWidget[];
  readonly isEditing: boolean;
  readonly onLayoutChange: (widgets: readonly DashboardWidget[]) => void;
  readonly onDelete: (id: string) => void;
  readonly gateway: DashboardGateway;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

export function DesktopWidgetGrid({
  widgets,
  isEditing,
  onLayoutChange,
  onDelete,
  gateway,
  onWidgetChange,
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
            cancel: ".luna-title-bar-button",
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
              <WidgetRenderer
                widget={widget}
                isEditingLayout={isEditing}
                onDelete={() => onDelete(widget.id)}
                gateway={gateway}
                onWidgetChange={onWidgetChange}
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
    ...gridSizeLimits(widget),
    i: widget.id,
    x: widget.position.column,
    y: widget.position.row,
    w: widget.size.columns,
    h: widget.size.rows,
    isDraggable: isEditing,
    isResizable: isEditing,
    isBounded: true,
  }));
}

export function fromGridLayout(
  layout: Layout,
  widgets: readonly DashboardWidget[],
): DashboardWidget[] {
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
  const nextWidgets: DashboardWidget[] = [];

  for (const item of layout) {
    const widget = widgetsById.get(item.i);
    if (!widget) {
      continue;
    }
    nextWidgets.push({
      ...widget,
      position: { column: item.x, row: item.y },
      size: { columns: item.w, rows: item.h },
    });
  }

  return sortWidgetLayouts(nextWidgets);
}

function gridSizeLimits(widget: WidgetLayout) {
  const policy = WIDGET_SIZE_BY_TYPE[widget.type];
  return {
    minW: policy.MIN_COLUMNS,
    minH: policy.MIN_ROWS,
    maxW: policy.MAX_COLUMNS,
    maxH: policy.MAX_ROWS,
  };
}
