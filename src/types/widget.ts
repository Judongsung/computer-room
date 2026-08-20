import type { WIDGET_TYPE } from "../constants/widget";

export type WidgetType = (typeof WIDGET_TYPE)[keyof typeof WIDGET_TYPE];

export interface GridPosition {
  readonly column: number;
  readonly row: number;
}

export interface GridSize {
  readonly columns: number;
  readonly rows: number;
}

export interface WidgetLayout {
  readonly id: string;
  readonly type: WidgetType;
  readonly position: GridPosition;
  readonly size: GridSize;
}

export interface WidgetLayoutCollection {
  readonly items: readonly WidgetLayout[];
}
