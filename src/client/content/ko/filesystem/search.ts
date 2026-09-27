import { FILESYSTEM_SEARCH_KIND, FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";

export const FILESYSTEM_SEARCH_COPY = {
  TITLE: "파일 검색",
  QUERY: "검색어",
  MODE: "검색 대상",
  CONTENT_GUIDE: "본문 검색은 현재 저장된 메모와 활성 체크리스트 항목을 지원합니다.",
  SUBMIT: "검색",
  SCOPE: "검색 위치",
  CLOSE: "검색 닫기",
  KIND: "종류",
  GUIDE: "찾을 내용을 입력하고 검색해 주세요.",
  EMPTY: "검색 결과가 없습니다.",
  INVALID: "검색어를 입력하고 길이를 확인해 주세요.",
  FAILED: "검색 결과를 불러오지 못했습니다.",
  OPEN_FOLDER: "폴더 열기",
  EXECUTED: (q: string, scope: string, kind: string, mode: string) => `검색: ${q} · ${scope} · ${kind} · ${mode}`,
} as const;

export const FILESYSTEM_SEARCH_MODE_LABEL = {
  [FILESYSTEM_SEARCH_MODE.NAME]: "이름",
  [FILESYSTEM_SEARCH_MODE.CONTENT]: "본문",
  [FILESYSTEM_SEARCH_MODE.ALL]: "이름과 본문",
} as const;

export const FILESYSTEM_SEARCH_KIND_LABEL = {
  [FILESYSTEM_SEARCH_KIND.SHORTCUT]: "바로가기",
  [FILESYSTEM_SEARCH_KIND.ALL]: "전체",
  [FILESYSTEM_SEARCH_KIND.FILE]: "파일",
  [FILESYSTEM_SEARCH_KIND.DIRECTORY]: "폴더",
  [FILESYSTEM_SEARCH_KIND.PROGRAM]: "프로그램",
} as const;
