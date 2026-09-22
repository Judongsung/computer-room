export const SHORTCUT_COPY = {
  CREATE: "바로가기 만들기",
  CREATE_HERE: "여기에 만들기",
  KIND: "바로가기",
  SUFFIX: " - 바로가기",
  OPEN_FAILED: "바로가기의 원본을 열 수 없습니다. 다시 시도해 주세요.",
  SKIPPED: (count: number) => `바로가기 ${count}개는 다운로드에서 제외됩니다.`,
} as const;
