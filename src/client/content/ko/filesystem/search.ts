import { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";

export const FILESYSTEM_SEARCH_COPY = {
  TITLE: "파일 검색",
  QUERY: "이름 검색",
  SUBMIT: "검색",
  SCOPE: "검색 위치",
  CLOSE: "검색 닫기",
  KIND: "종류",
  GUIDE: "이름의 일부를 입력하고 검색해 주세요.",
  EMPTY: "검색 결과가 없습니다.",
  INVALID: "검색어를 입력하고 길이를 확인해 주세요.",
  FAILED: "검색 결과를 불러오지 못했습니다.",
  OPEN_FOLDER: "폴더 열기",
  EXECUTED: (q: string, scope: string, kind: string) => `검색: ${q} · ${scope} · ${kind}`,
} as const;

export const FILESYSTEM_SEARCH_KIND_LABEL = {
  [FILESYSTEM_SEARCH_KIND.ALL]: "전체",
  [FILESYSTEM_SEARCH_KIND.FILE]: "파일",
  [FILESYSTEM_SEARCH_KIND.DIRECTORY]: "폴더",
  [FILESYSTEM_SEARCH_KIND.PROGRAM]: "프로그램",
} as const;
