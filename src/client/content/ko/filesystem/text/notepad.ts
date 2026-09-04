import { TEXT_FILE_ERROR_CODE } from "@client/constants/filesystem/text/text-file";

export const NOTEPAD_COPY = {
  TITLE: "메모장",
  WINDOW_TITLE: (name: string) => `${name} - 메모장`,
  TEXT_LABEL: "파일 원문 (읽기 전용)",
  LOADING: "파일을 읽는 중…",
  COPY_ALL: "전체 복사",
  COPIED: "복사했습니다.",
  COPY_FAILED: "복사하지 못했습니다. 텍스트를 선택해 직접 복사해 주세요.",
  DOWNLOAD: "다운로드",
  RETRY: "다시 시도",
  CANCEL: "취소",
  DOWNLOAD_TITLE: "파일 다운로드",
  DOWNLOAD_CONFIRM: (name: string) => `이 형식은 화면에서 열 수 없습니다. “${name}” 파일을 다운로드할까요?`,
} as const;

export const TEXT_FILE_ERROR_MESSAGE = {
  [TEXT_FILE_ERROR_CODE.TOO_LARGE]: "메모장 열람 크기 제한을 초과했습니다. 원본을 다운로드해 확인해 주세요.",
  [TEXT_FILE_ERROR_CODE.INVALID_ENCODING]: "UTF-8 텍스트로 읽을 수 없는 파일입니다. 원본을 다운로드해 확인해 주세요.",
  [TEXT_FILE_ERROR_CODE.LOAD_FAILED]: "파일을 읽지 못했습니다. 접근 권한과 파일 상태를 확인한 뒤 다시 시도해 주세요.",
} as const;
