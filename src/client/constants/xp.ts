export const XP_WINDOW_CONTROL_ACTION = {
  MINIMIZE: "minimize",
  MAXIMIZE: "maximize",
  RESTORE: "restore",
  CLOSE: "close",
} as const;

export const XP_WIDGET_TOOLBAR_ACTION = {
  EDIT: "edit",
  COMPLETE: "complete",
  HISTORY: "history",
  SAVE_FILE: "save-file",
} as const;

export const XP_WINDOW_INTERACTION_CLASS_NAME = {
  TITLE_BAR: "xp-window-frame__title-bar",
  CONTROLS: "xp-window-frame__controls",
} as const;

export const XP_WINDOW_INTERACTION_SELECTOR = {
  CONTROLS: `.${XP_WINDOW_INTERACTION_CLASS_NAME.CONTROLS}`,
} as const;
