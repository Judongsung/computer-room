export const WIDGET_TYPE = {
  BLANK: "blank",
} as const;

export const WIDGET_TYPE_VALUES = [WIDGET_TYPE.BLANK] as const;

export const GRID_COLUMN_COUNT = 12;
export const GRID_MAX_START_ROW = 999;
export const MAX_WIDGET_COUNT = 50;

export const BLANK_WIDGET_SIZE = {
  DEFAULT_COLUMNS: 4,
  DEFAULT_ROWS: 3,
  MIN_COLUMNS: 2,
  MIN_ROWS: 2,
  MAX_COLUMNS: GRID_COLUMN_COUNT,
  MAX_ROWS: 12,
} as const;
