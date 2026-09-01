export const GUEST_DESKTOP_WINDOW_ID_PREFIX = {
  PROGRAM: "guest-program-",
} as const;

export const GUEST_DESKTOP_LAYOUT = {
  FIXED_SHORTCUT_COUNT: 1,
} as const;

export const GUEST_DESKTOP_CLASS_NAME = {
  SHORTCUTS: "guest-desktop-shortcuts",
  START_MENU: "guest-start-menu",
  PROGRAM_BODY: "guest-program-window__body",
} as const;

export const GUEST_MOBILE_CLASS_NAME = {
  PROGRAM: "guest-mobile-program",
} as const;
