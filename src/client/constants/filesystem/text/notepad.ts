export const NOTEPAD_WINDOW = {
  ID_PREFIX: "notepad-window-",
  SIZE: { width: 720, height: 540 },
  MIN_WIDTH: 400,
  MIN_HEIGHT: 300,
} as const;
export const NOTEPAD_CLASS_NAME = {
  DESKTOP_BODY: "notepad-body",
  MOBILE: "android-notepad",
  CONTENT: "text-document",
  TEXT: "text-document__text",
  ACTIONS: "text-document__actions",
  STATUS: "text-document__status",
} as const;
