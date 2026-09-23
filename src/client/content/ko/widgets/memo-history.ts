import { KOREA_TIME_ZONE } from "@/constants/platform/date";
import { MAX_MEMO_VERSIONS } from "@/constants/widgets/memo";
import { UI_LOCALE } from "@client/content/ko/shared/format";

export const MEMO_HISTORY_COPY = {
  TITLE: "메모 버전 기록",
  OPEN: "버전 기록",
  VERSION: (version: number) => `버전 ${version}`,
  UNKNOWN_TIME: "저장 시각 알 수 없음",
  LOADING: "버전 기록을 불러오는 중…",
  DETAIL_LOADING: "선택한 버전을 불러오는 중…",
  EMPTY: "저장된 버전이 없습니다.",
  LIST_FAILED: "버전 기록을 불러오지 못했습니다.",
  DETAIL_FAILED: "선택한 버전을 불러오지 못했습니다.",
  EXPIRED: "이 버전은 더 이상 남아 있지 않습니다. 목록을 다시 불러오세요.",
  RETRY: "다시 시도",
  RELOAD_LIST: "목록 다시 불러오기",
  LOAD_DRAFT: "편집기에 불러오기",
  LOAD_NOTICE: "불러온 내용은 저장해야 반영됩니다.",
  RETENTION_NOTICE: `최근 ${MAX_MEMO_VERSIONS}개 버전만 보관됩니다.`,
  CLOSE: "닫기",
} as const;

const FORMATTER = new Intl.DateTimeFormat(UI_LOCALE, {
  timeZone: KOREA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export function formatMemoVersionTime(savedAt: string | null): string {
  return savedAt === null ? MEMO_HISTORY_COPY.UNKNOWN_TIME : FORMATTER.format(new Date(savedAt));
}
