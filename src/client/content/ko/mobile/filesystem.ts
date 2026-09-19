export const MOBILE_FILESYSTEM_COPY = {
  SELECT: "선택",
  SELECT_ALL: "불러온 항목 전체 선택",
  CANCEL_SELECTION: "선택 취소",
  TRASH_CONFIRM: (count: number) => `${count}개 항목을 휴지통으로 이동할까요?`,
  DELETE_CONFIRM: (count: number) => `${count}개 항목을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
  EMPTY_CONFIRM: "아직 불러오지 않은 항목을 포함해 휴지통 전체를 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
  LOADED_COUNT: (count: number) => `현재 불러온 항목: ${count}개`,
  DISCARD_TRANSFER: "남은 항목의 재시도 목록을 버리고 닫을까요?",
} as const;
