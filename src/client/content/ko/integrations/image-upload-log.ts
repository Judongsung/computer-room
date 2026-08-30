import { IMAGE_UPLOAD_LOG_RETENTION_DAYS } from "@/constants/integrations/image-upload-log";
import { KOREA_TIME_ZONE } from "@/constants/platform/date";
import { UI_LOCALE } from "@client/content/ko/shared/format";

export const IMAGE_UPLOAD_LOG_COPY = {
  TABS_LABEL: "이미지 API 프로필 화면",
  PROFILES_TAB: "프로필",
  LOGS_TAB: "수신 기록",
  FILTER_PROFILE: "프로필",
  FILTER_RESULT: "결과",
  ALL_PROFILES: "모든 프로필",
  ALL_RESULTS: "모든 결과",
  SUCCESS: "성공",
  FAILURE: "실패",
  RECEIVED_AT: "수신 시각",
  FILE_OR_ERROR: "파일 또는 오류",
  CONTENT_TYPE: "형식",
  SIZE: "크기",
  DURATION: "처리 시간",
  UNKNOWN_PROFILE: "알 수 없는 프로필",
  EMPTY_VALUE: "-",
  UNAVAILABLE_FILE: "파일이 이동되었거나 휴지통에 있습니다.",
  EMPTY: "조건에 맞는 수신 기록이 없습니다.",
  LOADING: "수신 기록을 불러오는 중…",
  LOAD_FAILED: "이미지 수신 기록을 불러오지 못했습니다.",
  RETRY: "다시 시도",
  LOAD_MORE: "더 보기",
  RETENTION_NOTICE:
    `기록은 ${IMAGE_UPLOAD_LOG_RETENTION_DAYS}일간 보관되며 매일 00:00 KST에 지난 기록을 정리합니다.`,
  MILLISECONDS: (value: number) => `${value} ms`,
  HTTP_STATUS: (value: number) => `HTTP ${value}`,
} as const;

export const IMAGE_UPLOAD_LOG_DATE_FORMAT = new Intl.DateTimeFormat(UI_LOCALE, {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
