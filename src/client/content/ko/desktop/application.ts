import { WIDGET_TYPE } from "@/constants/widgets/widget";

export const APPLICATION_NAME_BY_TYPE = {
  [WIDGET_TYPE.MEMO]: "메모",
  [WIDGET_TYPE.DAILY_CHECKLIST]: "일일 체크리스트",
  [WIDGET_TYPE.STORAGE_STATUS]: "저장소 상태",
  [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: "이미지 API 프로필",
  [WIDGET_TYPE.ADMIN]: "관리자",
} as const;
