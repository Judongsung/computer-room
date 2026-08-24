import {
  STORAGE_MIME_CATEGORY,
  STORAGE_OBJECT_PURPOSE,
} from "@/constants/storage/storage-status";
import { KOREA_TIME_ZONE } from "@/constants/platform/date";

export const STORAGE_STATUS_COPY = {
  TITLE: "저장소 상태",
  REFRESH: "새로 고침",
  RETRY: "다시 시도",
  LOADING: "저장소 사용량을 측정하는 중…",
  LOAD_FAILED: "저장소 상태를 불러오지 못했습니다.",
  R2_TITLE: "R2 객체 저장소",
  D1_TITLE: "D1 데이터베이스",
  TOTAL_USAGE: "전체 사용량",
  STANDARD_USAGE: "Standard 현재 사용량",
  DATABASE_USAGE: "데이터베이스 크기",
  MIME_BREAKDOWN: "파일 종류별 R2 사용 비율",
  PURPOSE_BREAKDOWN: "저장 목적별 사용량",
  FILESYSTEM_COUNTS: "등록 상태",
  REGISTERED_FILES: "준비 완료 파일",
  DIRECTORIES: "폴더",
  WIDGETS: "위젯",
  TRASH_ITEMS: "휴지통 항목",
  MEASURED_AT: "측정 시각",
  R2_FREE_REFERENCE: "Standard 무료 10 GB-month 참고",
  R2_FREE_REFERENCE_NOTE:
    "현재 사용량의 참고 비율입니다. 실제 R2 청구량은 일별 최고 사용량의 월평균으로 계산됩니다.",
  D1_FREE_REFERENCE: "D1 Free 데이터베이스 500 MB 기준",
  WARNING: "무료 기준에 가까워졌습니다.",
  EXCEEDED: "무료 기준을 초과했습니다.",
  EMPTY: "저장된 객체가 없습니다.",
  PERCENT_SUFFIX: "%",
  COUNT_SUFFIX: "개",
} as const;

export const STORAGE_MIME_CATEGORY_LABEL = {
  [STORAGE_MIME_CATEGORY.IMAGE]: "이미지",
  [STORAGE_MIME_CATEGORY.VIDEO]: "영상",
  [STORAGE_MIME_CATEGORY.AUDIO]: "오디오",
  [STORAGE_MIME_CATEGORY.DOCUMENT]: "문서",
  [STORAGE_MIME_CATEGORY.ARCHIVE]: "압축",
  [STORAGE_MIME_CATEGORY.OTHER]: "기타",
} as const;

export const STORAGE_MIME_CATEGORY_COLOR = {
  [STORAGE_MIME_CATEGORY.IMAGE]: "#3b78d8",
  [STORAGE_MIME_CATEGORY.VIDEO]: "#7456b8",
  [STORAGE_MIME_CATEGORY.AUDIO]: "#2e9b62",
  [STORAGE_MIME_CATEGORY.DOCUMENT]: "#d39a28",
  [STORAGE_MIME_CATEGORY.ARCHIVE]: "#b65a36",
  [STORAGE_MIME_CATEGORY.OTHER]: "#7b8794",
} as const;

export const STORAGE_OBJECT_PURPOSE_LABEL = {
  [STORAGE_OBJECT_PURPOSE.ORIGINAL]: "원본 파일",
  [STORAGE_OBJECT_PURPOSE.THUMBNAIL]: "썸네일 캐시",
  [STORAGE_OBJECT_PURPOSE.OTHER]: "기타 객체",
} as const;

export const STORAGE_USAGE_LEVEL = {
  NORMAL: "normal",
  WARNING: "warning",
  EXCEEDED: "exceeded",
} as const;

export const STORAGE_STATUS_CLASS_NAME = {
  ROOT: "storage-status-widget",
  SUMMARY: "storage-status-widget__summary",
  PANEL: "storage-status-widget__panel",
  METER: "storage-status-widget__meter",
  METER_LABEL: "storage-status-widget__meter-label",
  METER_TRACK: "storage-status-widget__meter-track",
  METER_FILL: "storage-status-widget__meter-fill",
  GRAPH: "storage-status-widget__graph",
  GRAPH_SEGMENT: "storage-status-widget__graph-segment",
  LEGEND: "storage-status-widget__legend",
  COUNTS: "storage-status-widget__counts",
  NOTE: "storage-status-widget__note",
  TIMESTAMP: "storage-status-widget__timestamp",
} as const;

export const STORAGE_STATUS_STYLE_PROPERTY = {
  SEGMENT_COLOR: "--storage-segment-color",
} as const;

export const STORAGE_STATUS_DATE_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;
