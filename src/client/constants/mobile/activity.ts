export const MOBILE_ACTIVITY_KIND = {
  HOME: "home",
  DIRECTORY: "directory",
  COMPUTER: "computer",
  TRASH: "trash",
  MEDIA: "media",
  TEXT_FILE: "text-file",
  WIDGET_FILE: "widget-file",
  WIDGET_DRAFT: "widget-draft",
  STORAGE_STATUS: "storage-status",
  WALLPAPER: "wallpaper",
} as const;

export const MOBILE_ACTIVITY_MENU_AVAILABILITY = {
  [MOBILE_ACTIVITY_KIND.HOME]: true,
  [MOBILE_ACTIVITY_KIND.DIRECTORY]: true,
  [MOBILE_ACTIVITY_KIND.COMPUTER]: false,
  [MOBILE_ACTIVITY_KIND.TRASH]: true,
  [MOBILE_ACTIVITY_KIND.MEDIA]: true,
  [MOBILE_ACTIVITY_KIND.TEXT_FILE]: false,
  [MOBILE_ACTIVITY_KIND.WIDGET_FILE]: false,
  [MOBILE_ACTIVITY_KIND.WIDGET_DRAFT]: true,
  [MOBILE_ACTIVITY_KIND.STORAGE_STATUS]: false,
  [MOBILE_ACTIVITY_KIND.WALLPAPER]: false,
} as const;
