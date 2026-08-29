import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/shared/mobile";
import type { MobileActivity } from "@client/types/app/mobile-navigation";

export function mobileActivityKey(activity: MobileActivity): string {
  switch (activity.kind) {
    case MOBILE_ACTIVITY_KIND.DIRECTORY:
      return `${activity.kind}:${activity.directoryId}`;
    case MOBILE_ACTIVITY_KIND.MEDIA:
      return `${activity.kind}:${activity.file.id}`;
    case MOBILE_ACTIVITY_KIND.WIDGET_FILE:
      return `${activity.kind}:${activity.entryId}`;
    default:
      return activity.kind;
  }
}

export function mobileActivityTitle(activity: MobileActivity): string {
  switch (activity.kind) {
    case MOBILE_ACTIVITY_KIND.HOME:
      return MOBILE_COPY.HOME_SCREEN;
    case MOBILE_ACTIVITY_KIND.DIRECTORY:
    case MOBILE_ACTIVITY_KIND.WIDGET_FILE:
      return activity.title;
    case MOBILE_ACTIVITY_KIND.COMPUTER:
      return MOBILE_COPY.MY_COMPUTER;
    case MOBILE_ACTIVITY_KIND.TRASH:
      return MOBILE_COPY.RECYCLE_BIN;
    case MOBILE_ACTIVITY_KIND.MEDIA:
      return activity.file.name;
    case MOBILE_ACTIVITY_KIND.WIDGET_DRAFT:
      return MOBILE_COPY.DRAFT_EXISTS_TITLE;
    case MOBILE_ACTIVITY_KIND.STORAGE_STATUS:
      return MOBILE_COPY.OPEN_STORAGE_STATUS;
    case MOBILE_ACTIVITY_KIND.WALLPAPER:
      return MOBILE_COPY.WALLPAPER;
  }
}
