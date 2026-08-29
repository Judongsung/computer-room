import { KOREA_TIME_ZONE } from "@/constants/platform/date";

export const FOLDER_PROPERTIES_COPY = {
  PROPERTIES: "속성",
  TITLE: (name: string) => `${name} 속성`,
  DIALOG_LABEL: "폴더 속성",
  TYPE: "종류",
  TYPE_VALUE: "파일 폴더",
  LOCATION: "위치",
  SIZE: "크기",
  SIZE_VALUE: (formatted: string, bytes: string) =>
    `${formatted} (${bytes}바이트)`,
  CONTAINS: "포함",
  CONTAINS_VALUE: (files: string, directories: string, widgets: string) =>
    `파일 ${files}개, 폴더 ${directories}개, 위젯 파일 ${widgets}개`,
  CREATED_AT: "만든 날짜",
  UPDATED_AT: "수정한 날짜",
  LOADING: "폴더 정보를 계산하는 중…",
  LOAD_FAILED: "폴더 정보를 불러오지 못했습니다.",
  REFRESH: "새로 고침",
  RETRY: "다시 시도",
  CLOSE: "닫기",
} as const;

export const FOLDER_PROPERTIES_DATE_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;
