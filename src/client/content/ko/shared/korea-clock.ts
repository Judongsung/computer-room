import { KOREA_TIME_ZONE } from "@/constants/platform/date";

export const KOREA_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;

export const KOREA_DATE_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;
