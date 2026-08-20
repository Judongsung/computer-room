export const WIDGET_TYPE = {
  MEMO: "memo",
  DAILY_CHECKLIST: "daily-checklist",
} as const;

export const WIDGET_TYPE_VALUES = [
  WIDGET_TYPE.MEMO,
  WIDGET_TYPE.DAILY_CHECKLIST,
] as const;

export const GRID_COLUMN_COUNT = 12;
export const GRID_MAX_START_ROW = 999;
export const MAX_WIDGET_COUNT = 50;

export const WIDGET_SIZE_LIMITS = {
  MIN_COLUMNS: 2,
  MIN_ROWS: 2,
  MAX_COLUMNS: GRID_COLUMN_COUNT,
  MAX_ROWS: 12,
} as const;

export const WIDGET_SIZE_BY_TYPE = {
  [WIDGET_TYPE.MEMO]: {
    DEFAULT_COLUMNS: 4,
    DEFAULT_ROWS: 3,
    ...WIDGET_SIZE_LIMITS,
  },
  [WIDGET_TYPE.DAILY_CHECKLIST]: {
    DEFAULT_COLUMNS: 4,
    DEFAULT_ROWS: 4,
    ...WIDGET_SIZE_LIMITS,
  },
} as const;
