export const WIDGET_TYPE = {
  MEMO: "memo",
  DAILY_CHECKLIST: "daily-checklist",
  STORAGE_STATUS: "storage-status",
  IMAGE_UPLOAD_PROFILES: "image-upload-profiles",
} as const;

export const WIDGET_TYPE_VALUES = [
  WIDGET_TYPE.MEMO,
  WIDGET_TYPE.DAILY_CHECKLIST,
  WIDGET_TYPE.STORAGE_STATUS,
  WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
] as const;

export const WIDGET_BEHAVIOR = {
  [WIDGET_TYPE.MEMO]: {
    singleton: false,
    supportsFileStorage: true,
    persistsWithoutFile: false,
  },
  [WIDGET_TYPE.DAILY_CHECKLIST]: {
    singleton: false,
    supportsFileStorage: true,
    persistsWithoutFile: false,
  },
  [WIDGET_TYPE.STORAGE_STATUS]: {
    singleton: true,
    supportsFileStorage: false,
    persistsWithoutFile: true,
  },
  [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: {
    singleton: true,
    supportsFileStorage: false,
    persistsWithoutFile: true,
  },
} as const;

export const MAX_WIDGET_COUNT = 50;
export const MAX_OPEN_WIDGET_COUNT = MAX_WIDGET_COUNT;

export const WINDOW_STATE = {
  NORMAL: "normal",
  MINIMIZED: "minimized",
  MAXIMIZED: "maximized",
} as const;

export const WINDOW_STATE_VALUES = [
  WINDOW_STATE.NORMAL,
  WINDOW_STATE.MINIMIZED,
  WINDOW_STATE.MAXIMIZED,
] as const;

export const WINDOW_RESTORE_STATE = {
  NORMAL: WINDOW_STATE.NORMAL,
  MAXIMIZED: WINDOW_STATE.MAXIMIZED,
} as const;

export const WINDOW_RESTORE_STATE_VALUES = [
  WINDOW_RESTORE_STATE.NORMAL,
  WINDOW_RESTORE_STATE.MAXIMIZED,
] as const;

export const WINDOW_POSITION_LIMITS = {
  MIN_X: 0,
  MIN_Y: 0,
  MAX_X: 8_192,
  MAX_Y: 8_192,
} as const;

export const WINDOW_SIZE_LIMITS = {
  MAX_WIDTH: 4_096,
  MAX_HEIGHT: 2_160,
} as const;

export const WIDGET_WINDOW_POLICY = {
  [WIDGET_TYPE.MEMO]: {
    DEFAULT_WIDTH: 480,
    DEFAULT_HEIGHT: 320,
    MIN_WIDTH: 320,
    MIN_HEIGHT: 220,
    ...WINDOW_SIZE_LIMITS,
  },
  [WIDGET_TYPE.DAILY_CHECKLIST]: {
    DEFAULT_WIDTH: 480,
    DEFAULT_HEIGHT: 420,
    MIN_WIDTH: 360,
    MIN_HEIGHT: 280,
    ...WINDOW_SIZE_LIMITS,
  },
  [WIDGET_TYPE.STORAGE_STATUS]: {
    DEFAULT_WIDTH: 560,
    DEFAULT_HEIGHT: 500,
    MIN_WIDTH: 480,
    MIN_HEIGHT: 400,
    ...WINDOW_SIZE_LIMITS,
  },
  [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: {
    DEFAULT_WIDTH: 720,
    DEFAULT_HEIGHT: 560,
    MIN_WIDTH: 600,
    MIN_HEIGHT: 460,
    ...WINDOW_SIZE_LIMITS,
  },
} as const;

export const WIDGET_FILE_DEFAULT_LAYOUT = {
  POSITION: { x: 32, y: 32 },
  STACK_ORDER: 0,
} as const;
